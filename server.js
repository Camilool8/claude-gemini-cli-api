const express = require("express");
const { spawn } = require("child_process");
const basicAuth = require("express-basic-auth");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ===========================
// CONFIGURATION
// ===========================
const CONFIG = {
  PORT: process.env.PORT || 3000,
  AUTH_ENABLED: process.env.AUTH_ENABLED === "true",
  AUTH_USERS: process.env.AUTH_USERS || "admin:changeme",
  MAX_PROMPT_LENGTH: parseInt(process.env.MAX_PROMPT_LENGTH) || 100000,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 300000, // 5 minutes
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 min
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  DEFAULT_CLI: process.env.DEFAULT_CLI || "claude", // claude or gemini
  ENABLE_FALLBACK: process.env.ENABLE_FALLBACK === "true" || true, // Enable fallback by default
  CLAUDE_DEFAULT_MODEL: process.env.CLAUDE_DEFAULT_MODEL || "sonnet",
  GEMINI_DEFAULT_MODEL: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",
};

/**
 * Get default model for a specific CLI
 */
function getDefaultModel(cli) {
  if (cli === "gemini") {
    return CONFIG.GEMINI_DEFAULT_MODEL;
  }
  return CONFIG.CLAUDE_DEFAULT_MODEL;
}

// ===========================
// MIDDLEWARE
// ===========================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: CONFIG.CORS_ORIGIN,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logging
if (CONFIG.LOG_LEVEL !== "none") {
  app.use(morgan("combined"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW,
  max: CONFIG.RATE_LIMIT_MAX,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Basic Authentication
const authMiddleware = basicAuth({
  users: CONFIG.AUTH_USERS.split(",").reduce((acc, pair) => {
    const [username, password] = pair.split(":");
    acc[username] = password;
    return acc;
  }, {}),
  challenge: true,
  realm: "Claude Code API",
});

// Apply auth conditionally
const maybeAuth = (req, res, next) => {
  if (CONFIG.AUTH_ENABLED) {
    return authMiddleware(req, res, next);
  }
  next();
};

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Map common parameters to Gemini CLI arguments
 */
function mapToGeminiArgs(options) {
  const {
    prompt,
    outputFormat = "json",
    model = getDefaultModel("gemini"),
    systemPrompt,
    allowedTools,
    dangerouslySkipPermissions = false,
    sessionId,
    resumeSession,
  } = options;

  const args = [];

  // Output format
  if (outputFormat === "stream-json") {
    args.push("--output-format", "stream-json");
  } else if (outputFormat === "json") {
    args.push("--output-format", "json");
  } else {
    args.push("--output-format", "text");
  }

  // Model (always add model, use default if not specified)
  args.push("--model", model);

  // System prompt (Gemini uses extensions or inline prompt modification)
  // Note: Gemini doesn't have direct --system-prompt flag, so we prepend it to the prompt
  let finalPrompt = prompt;
  if (systemPrompt) {
    finalPrompt = `System: ${systemPrompt}\n\nUser: ${prompt}`;
  }

  // YOLO mode (auto-approve all tools)
  if (dangerouslySkipPermissions) {
    args.push("--yolo");
  } else if (allowedTools && allowedTools.length > 0) {
    args.push("--allowed-tools", ...allowedTools);
  }

  // Session management
  if (resumeSession) {
    args.push("--resume", resumeSession);
  } else if (sessionId) {
    // Gemini doesn't have session-id, but we can use resume with "latest"
    args.push("--resume", "latest");
  }

  // Add prompt last
  args.push(finalPrompt);

  return args;
}

/**
 * Execute Gemini CLI command
 */
function executeGeminiCLI(options) {
  return new Promise((resolve, reject) => {
    const { timeout = CONFIG.REQUEST_TIMEOUT } = options;

    const args = mapToGeminiArgs(options);

    console.log(
      `[Gemini CLI] Executing: gemini ${args.slice(0, -1).join(" ")} <prompt>`
    );

    const gemini = spawn("gemini", args, {
      timeout,
      killSignal: "SIGTERM",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeoutHandle = setTimeout(() => {
      killed = true;
      gemini.kill("SIGTERM");
      reject(new Error("Request timeout exceeded"));
    }, timeout);

    gemini.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    gemini.stderr.on("data", (data) => {
      const errMsg = data.toString();
      stderr += errMsg;
      if (errMsg.trim()) {
        console.error("[Gemini stderr]", errMsg.trim());
      }
    });

    gemini.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`));
    });

    gemini.on("close", (code) => {
      clearTimeout(timeoutHandle);

      if (killed) {
        return;
      }

      if (code !== 0) {
        return reject(
          new Error(`Gemini CLI exited with code ${code}: ${stderr}`)
        );
      }

      resolve({ stdout, stderr });
    });
  });
}

/**
 * Execute Claude Code command
 */
function executeClaudeCode(options) {
  return new Promise((resolve, reject) => {
    const {
      prompt,
      outputFormat = "json",
      model = getDefaultModel("claude"),
      systemPrompt,
      appendSystemPrompt,
      allowedTools,
      disallowedTools,
      dangerouslySkipPermissions = false,
      settings,
      mcpConfig,
      sessionId,
      continueSession = false,
      resumeSession,
      includePartialMessages = false,
      timeout = CONFIG.REQUEST_TIMEOUT,
    } = options;

    const args = ["--print"];

    // Output format
    args.push("--output-format", outputFormat);
    if (includePartialMessages && outputFormat === "stream-json") {
      args.push("--include-partial-messages");
    }

    // Model
    if (model) args.push("--model", model);

    // System prompts
    if (systemPrompt) args.push("--system-prompt", systemPrompt);
    if (appendSystemPrompt)
      args.push("--append-system-prompt", appendSystemPrompt);

    // Tool controls
    if (allowedTools && allowedTools.length > 0) {
      args.push("--allowed-tools", allowedTools.join(" "));
    }
    if (disallowedTools && disallowedTools.length > 0) {
      args.push("--disallowed-tools", disallowedTools.join(" "));
    }

    // Permissions
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    // Settings
    if (settings) {
      args.push("--settings", JSON.stringify(settings));
    }

    // MCP Configuration
    if (mcpConfig && mcpConfig.length > 0) {
      args.push("--mcp-config", ...mcpConfig);
    }

    // Session management
    if (continueSession) {
      args.push("--continue");
    }
    if (resumeSession) {
      args.push("--resume", resumeSession);
    }
    if (sessionId) {
      args.push("--session-id", sessionId);
    }

    // Add prompt last
    args.push(prompt);

    console.log(
      `[Claude Code] Executing: claude ${args.slice(0, -1).join(" ")} <prompt>`
    );

    const claude = spawn("claude", args, {
      timeout,
      killSignal: "SIGTERM",
      stdio: ["ignore", "pipe", "pipe"], // stdin: ignore, stdout: pipe, stderr: pipe
      env: { ...process.env }, // Inherit environment variables
      shell: false, // Don't use shell
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeoutHandle = setTimeout(() => {
      killed = true;
      claude.kill("SIGTERM");
      reject(new Error("Request timeout exceeded"));
    }, timeout);

    claude.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    claude.stderr.on("data", (data) => {
      const errMsg = data.toString();
      stderr += errMsg;
      // Log stderr in real-time for debugging
      if (errMsg.trim()) {
        console.error("[Claude stderr]", errMsg.trim());
      }
    });

    claude.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
    });

    claude.on("close", (code) => {
      clearTimeout(timeoutHandle);

      if (killed) {
        return; // Already rejected with timeout
      }

      if (code !== 0) {
        return reject(
          new Error(`Claude Code exited with code ${code}: ${stderr}`)
        );
      }

      resolve({ stdout, stderr });
    });
  });
}

/**
 * Execute AI CLI command with fallback support
 * @param {Object} options - Execution options
 * @param {string} [preferredCLI] - Preferred CLI to use ('claude' or 'gemini')
 * @returns {Promise<{stdout: string, stderr: string, usedCLI: string}>}
 */
async function executeAICLI(options, preferredCLI = null) {
  const cliToUse = preferredCLI || options.cli || CONFIG.DEFAULT_CLI;
  const enableFallback = CONFIG.ENABLE_FALLBACK && !options.disableFallback;

  // Determine execution order
  const primaryCLI = cliToUse === "gemini" ? "gemini" : "claude";
  const fallbackCLI = primaryCLI === "claude" ? "gemini" : "claude";

  console.log(
    `[AI CLI] Primary: ${primaryCLI}, Fallback: ${
      enableFallback ? fallbackCLI : "disabled"
    }`
  );

  // Try primary CLI
  try {
    const result =
      primaryCLI === "claude"
        ? await executeClaudeCode(options)
        : await executeGeminiCLI(options);

    return { ...result, usedCLI: primaryCLI };
  } catch (primaryError) {
    console.error(`[${primaryCLI}] Failed:`, primaryError.message);

    // Try fallback if enabled
    if (enableFallback) {
      console.log(`[AI CLI] Attempting fallback to ${fallbackCLI}...`);
      try {
        const result =
          fallbackCLI === "claude"
            ? await executeClaudeCode(options)
            : await executeGeminiCLI(options);

        console.log(`[AI CLI] Fallback to ${fallbackCLI} successful`);
        return { ...result, usedCLI: fallbackCLI, fallbackUsed: true };
      } catch (fallbackError) {
        console.error(
          `[${fallbackCLI}] Fallback failed:`,
          fallbackError.message
        );
        throw new Error(
          `Both CLIs failed. Primary (${primaryCLI}): ${primaryError.message}. Fallback (${fallbackCLI}): ${fallbackError.message}`
        );
      }
    }

    // No fallback, throw primary error
    throw primaryError;
  }
}

/**
 * Parse Claude Code output
 */
function parseOutput(stdout, outputFormat) {
  if (outputFormat === "json") {
    try {
      return JSON.parse(stdout);
    } catch (e) {
      return { response: stdout, raw: true, parseError: e.message };
    }
  }
  return { response: stdout };
}

/**
 * Validate request payload
 */
function validateRequest(body) {
  const errors = [];

  if (!body.prompt) {
    errors.push("prompt is required");
  }

  if (body.prompt && body.prompt.length > CONFIG.MAX_PROMPT_LENGTH) {
    errors.push(
      `prompt exceeds maximum length of ${CONFIG.MAX_PROMPT_LENGTH} characters`
    );
  }

  if (
    body.outputFormat &&
    !["text", "json", "stream-json"].includes(body.outputFormat)
  ) {
    errors.push("outputFormat must be one of: text, json, stream-json");
  }

  return errors;
}

// ===========================
// ROUTES
// ===========================

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * API Info endpoint
 */
app.get("/api/info", maybeAuth, (req, res) => {
  res.json({
    version: "2.0.0",
    endpoints: {
      "/api/ask": "Simple prompt execution (supports both Claude and Gemini)",
      "/api/process": "Advanced prompt execution with all options",
      "/api/stream": "Streaming response",
      "/api/batch": "Batch processing multiple prompts",
      "/api/test": "Test CLI availability (add ?cli=claude or ?cli=gemini)",
    },
    config: {
      authEnabled: CONFIG.AUTH_ENABLED,
      maxPromptLength: CONFIG.MAX_PROMPT_LENGTH,
      requestTimeout: CONFIG.REQUEST_TIMEOUT,
      rateLimitWindow: CONFIG.RATE_LIMIT_WINDOW,
      rateLimitMax: CONFIG.RATE_LIMIT_MAX,
      defaultModel: getDefaultModel(CONFIG.DEFAULT_CLI),
      defaultCLI: CONFIG.DEFAULT_CLI,
      fallbackEnabled: CONFIG.ENABLE_FALLBACK,
    },
    supportedCLIs: ["claude", "gemini"],
    features: {
      autoFallback: CONFIG.ENABLE_FALLBACK,
      cliSelection: "Specify 'cli' parameter in request body",
      metadata: "Responses include which CLI was used",
    },
  });
});

/**
 * Simple ask endpoint
 */
app.post("/api/ask", maybeAuth, async (req, res) => {
  try {
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const {
      prompt,
      outputFormat = "json",
      model,
      systemPrompt,
      cli,
    } = req.body;

    const result = await executeAICLI({
      prompt,
      outputFormat,
      model,
      systemPrompt,
      cli,
    });

    const parsed = parseOutput(result.stdout, outputFormat);

    // Add metadata about which CLI was used
    if (typeof parsed === "object" && parsed !== null) {
      parsed._meta = {
        usedCLI: result.usedCLI,
        fallbackUsed: result.fallbackUsed || false,
      };
    }

    res.json(parsed);
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({
      error: "Failed to process request",
      message: error.message,
    });
  }
});

/**
 * Advanced process endpoint
 */
app.post("/api/process", maybeAuth, async (req, res) => {
  try {
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await executeAICLI(req.body);
    const parsed = parseOutput(result.stdout, req.body.outputFormat || "json");

    res.json({
      success: true,
      data: parsed,
      metadata: {
        model: req.body.model || getDefaultModel(result.usedCLI),
        outputFormat: req.body.outputFormat || "json",
        timestamp: new Date().toISOString(),
        usedCLI: result.usedCLI,
        fallbackUsed: result.fallbackUsed || false,
      },
    });
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({
      success: false,
      error: "Failed to process request",
      message: error.message,
    });
  }
});

/**
 * Streaming endpoint
 */
app.post("/api/stream", maybeAuth, async (req, res) => {
  try {
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const {
      prompt,
      model,
      systemPrompt,
      appendSystemPrompt,
      includePartialMessages = true,
      cli,
    } = req.body;

    const cliToUse = cli || CONFIG.DEFAULT_CLI;
    const modelToUse = model || getDefaultModel(cliToUse);

    let args = [];
    let command = "";

    if (cliToUse === "gemini") {
      command = "gemini";
      args = ["--output-format", "stream-json"];
      args.push("--model", modelToUse);

      let finalPrompt = prompt;
      if (systemPrompt) {
        finalPrompt = `System: ${systemPrompt}\n\nUser: ${prompt}`;
      } else if (appendSystemPrompt) {
        finalPrompt = `${appendSystemPrompt}\n\n${prompt}`;
      }
      args.push(finalPrompt);
    } else {
      command = "claude";
      args = ["--print", "--output-format", "stream-json"];
      if (includePartialMessages) args.push("--include-partial-messages");
      args.push("--model", modelToUse);
      if (systemPrompt) args.push("--system-prompt", systemPrompt);
      if (appendSystemPrompt)
        args.push("--append-system-prompt", appendSystemPrompt);
      args.push(prompt);
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const cliProcess = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      shell: false,
    });

    cliProcess.stdout.on("data", (data) => {
      res.write(data);
    });

    cliProcess.stderr.on("data", (data) => {
      console.error(`[${command} stderr]`, data.toString());
    });

    cliProcess.on("close", (code) => {
      if (code !== 0) {
        res.write(
          JSON.stringify({ error: `Process exited with code ${code}` }) + "\n"
        );
      }
      res.end();
    });

    cliProcess.on("error", (err) => {
      console.error(`[${command}] Spawn error:`, err.message);

      // Try fallback if enabled
      if (CONFIG.ENABLE_FALLBACK && !req.body.disableFallback) {
        const fallbackCLI = cliToUse === "claude" ? "gemini" : "claude";
        console.log(`[Stream] Attempting fallback to ${fallbackCLI}...`);

        // Restart with fallback CLI
        req.body.cli = fallbackCLI;
        req.body.disableFallback = true; // Prevent infinite loop
        return app.handle(req, res);
      }

      res.write(JSON.stringify({ error: err.message }) + "\n");
      res.end();
    });

    // Handle client disconnect
    req.on("close", () => {
      cliProcess.kill("SIGTERM");
    });
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({
      error: "Failed to start streaming",
      message: error.message,
    });
  }
});

/**
 * Batch processing endpoint
 */
app.post("/api/batch", maybeAuth, async (req, res) => {
  try {
    const { prompts, ...commonOptions } = req.body;

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: "prompts array is required" });
    }

    if (prompts.length > 10) {
      return res.status(400).json({ error: "Maximum 10 prompts per batch" });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < prompts.length; i++) {
      try {
        const prompt = prompts[i];
        const result = await executeAICLI({
          ...commonOptions,
          prompt: typeof prompt === "string" ? prompt : prompt.prompt,
          model: prompt.model || commonOptions.model,
          systemPrompt: prompt.systemPrompt || commonOptions.systemPrompt,
          cli: prompt.cli || commonOptions.cli,
        });

        const parsed = parseOutput(
          result.stdout,
          commonOptions.outputFormat || "json"
        );
        results.push({
          index: i,
          success: true,
          data: parsed,
          usedCLI: result.usedCLI,
          fallbackUsed: result.fallbackUsed || false,
        });
      } catch (error) {
        errors.push({
          index: i,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: prompts.length,
        successful: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({
      error: "Failed to process batch",
      message: error.message,
    });
  }
});

/**
 * Test AI CLI availability
 */
app.get("/api/test", maybeAuth, async (req, res) => {
  const cliToTest = req.query.cli || CONFIG.DEFAULT_CLI;

  try {
    const result = await executeAICLI(
      {
        prompt: `Say "Hello from ${
          cliToTest === "gemini" ? "Gemini" : "Claude"
        } CLI API!"`,
        outputFormat: "text",
        disableFallback: true, // Don't use fallback for testing
      },
      cliToTest
    );

    res.json({
      success: true,
      message: `${
        cliToTest === "gemini" ? "Gemini" : "Claude"
      } CLI is working correctly`,
      response: result.stdout.trim(),
      usedCLI: result.usedCLI,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `${
        cliToTest === "gemini" ? "Gemini" : "Claude"
      } CLI is not available or not working`,
      error: error.message,
    });
  }
});

// ===========================
// ERROR HANDLERS
// ===========================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Global Error]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// ===========================
// START SERVER
// ===========================

app.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log("=".repeat(50));
  console.log("AI CLI API Server (Claude Code & Gemini CLI)");
  console.log("=".repeat(50));
  console.log(`Port: ${CONFIG.PORT}`);
  console.log(
    `Authentication: ${CONFIG.AUTH_ENABLED ? "ENABLED" : "DISABLED"}`
  );
  console.log(`Default CLI: ${CONFIG.DEFAULT_CLI.toUpperCase()}`);
  console.log(`Fallback: ${CONFIG.ENABLE_FALLBACK ? "ENABLED" : "DISABLED"}`);
  console.log(`Default Model: ${getDefaultModel(CONFIG.DEFAULT_CLI)}`);
  console.log(
    `Rate Limit: ${CONFIG.RATE_LIMIT_MAX} requests per ${
      CONFIG.RATE_LIMIT_WINDOW / 60000
    } minutes`
  );
  console.log("=".repeat(50));
  console.log("Endpoints:");
  console.log(`  GET  /health`);
  console.log(`  GET  /api/info`);
  console.log(`  GET  /api/test?cli=claude|gemini`);
  console.log(`  POST /api/ask`);
  console.log(`  POST /api/process`);
  console.log(`  POST /api/stream`);
  console.log(`  POST /api/batch`);
  console.log("=".repeat(50));
  console.log(`Server is running on port ${CONFIG.PORT}`);
  console.log("=".repeat(50));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
