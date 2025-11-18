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
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "sonnet",
};

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
 * Execute Claude Code command
 */
function executeClaudeCode(options) {
  return new Promise((resolve, reject) => {
    const {
      prompt,
      outputFormat = "json",
      model = CONFIG.DEFAULT_MODEL,
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
    version: "1.0.0",
    endpoints: {
      "/api/ask": "Simple prompt execution",
      "/api/process": "Advanced prompt execution with all options",
      "/api/stream": "Streaming response",
      "/api/batch": "Batch processing multiple prompts",
    },
    config: {
      authEnabled: CONFIG.AUTH_ENABLED,
      maxPromptLength: CONFIG.MAX_PROMPT_LENGTH,
      requestTimeout: CONFIG.REQUEST_TIMEOUT,
      rateLimitWindow: CONFIG.RATE_LIMIT_WINDOW,
      rateLimitMax: CONFIG.RATE_LIMIT_MAX,
      defaultModel: CONFIG.DEFAULT_MODEL,
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

    const { prompt, outputFormat = "json", model, systemPrompt } = req.body;

    const result = await executeClaudeCode({
      prompt,
      outputFormat,
      model,
      systemPrompt,
    });

    const parsed = parseOutput(result.stdout, outputFormat);
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

    const result = await executeClaudeCode(req.body);
    const parsed = parseOutput(result.stdout, req.body.outputFormat || "json");

    res.json({
      success: true,
      data: parsed,
      metadata: {
        model: req.body.model || CONFIG.DEFAULT_MODEL,
        outputFormat: req.body.outputFormat || "json",
        timestamp: new Date().toISOString(),
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
      model = CONFIG.DEFAULT_MODEL,
      systemPrompt,
      appendSystemPrompt,
      includePartialMessages = true,
    } = req.body;

    const args = ["--print", "--output-format", "stream-json"];

    if (includePartialMessages) args.push("--include-partial-messages");
    if (model) args.push("--model", model);
    if (systemPrompt) args.push("--system-prompt", systemPrompt);
    if (appendSystemPrompt)
      args.push("--append-system-prompt", appendSystemPrompt);

    args.push(prompt);

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const claude = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"], // stdin: ignore, stdout: pipe, stderr: pipe
      env: { ...process.env }, // Inherit environment variables
      shell: false, // Don't use shell
    });

    claude.stdout.on("data", (data) => {
      res.write(data);
    });

    claude.stderr.on("data", (data) => {
      console.error("[Claude stderr]", data.toString());
    });

    claude.on("close", (code) => {
      if (code !== 0) {
        res.write(
          JSON.stringify({ error: `Process exited with code ${code}` }) + "\n"
        );
      }
      res.end();
    });

    claude.on("error", (err) => {
      res.write(JSON.stringify({ error: err.message }) + "\n");
      res.end();
    });

    // Handle client disconnect
    req.on("close", () => {
      claude.kill("SIGTERM");
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
        const result = await executeClaudeCode({
          ...commonOptions,
          prompt: typeof prompt === "string" ? prompt : prompt.prompt,
          model: prompt.model || commonOptions.model,
          systemPrompt: prompt.systemPrompt || commonOptions.systemPrompt,
        });

        const parsed = parseOutput(
          result.stdout,
          commonOptions.outputFormat || "json"
        );
        results.push({
          index: i,
          success: true,
          data: parsed,
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
 * Test Claude Code availability
 */
app.get("/api/test", maybeAuth, async (req, res) => {
  try {
    const result = await executeClaudeCode({
      prompt: 'Say "Hello from Claude Code API!"',
      outputFormat: "text",
    });

    res.json({
      success: true,
      message: "Claude Code is working correctly",
      response: result.stdout.trim(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Claude Code is not available or not working",
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
  console.log("Claude Code API Server");
  console.log("=".repeat(50));
  console.log(`Port: ${CONFIG.PORT}`);
  console.log(
    `Authentication: ${CONFIG.AUTH_ENABLED ? "ENABLED" : "DISABLED"}`
  );
  console.log(`Default Model: ${CONFIG.DEFAULT_MODEL}`);
  console.log(
    `Rate Limit: ${CONFIG.RATE_LIMIT_MAX} requests per ${
      CONFIG.RATE_LIMIT_WINDOW / 60000
    } minutes`
  );
  console.log("=".repeat(50));
  console.log("Endpoints:");
  console.log(`  GET  /health`);
  console.log(`  GET  /api/info`);
  console.log(`  GET  /api/test`);
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
