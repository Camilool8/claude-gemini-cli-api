# Claude Code API

A production-ready REST API wrapper for Claude Code CLI, designed for integration with automation platforms like n8n.

## Features

- RESTful API with simple HTTP endpoints
- Basic authentication for secure access
- Rate limiting to prevent abuse
- Comprehensive request logging
- Real-time streaming responses
- Batch processing capabilities
- Security headers via Helmet.js
- Configurable CORS support
- Request timeout protection
- Docker-ready for easy deployment

## Prerequisites

**Node.js** (v16 or higher)

**Claude Code CLI** must be installed and authenticated:

```bash
npm install -g @anthropic-ai/claude-code
claude setup-token
```

## Installation

Clone or download the repository:

```bash
git clone <your-repo>
cd claude-code-api
```

Install dependencies:

```bash
npm install
```

Configure environment:

```bash
cp .env.example .env
```

Edit the `.env` file with your settings:

```env
PORT=3000
AUTH_ENABLED=true
AUTH_USERS=admin:your_secure_password,n8n:another_password
MAX_PROMPT_LENGTH=100000
REQUEST_TIMEOUT=300000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
CORS_ORIGIN=*
DEFAULT_MODEL=sonnet
```

Start the server:

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

### Health Check

**GET** `/health`

No authentication required. Returns server status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.456
}
```

### API Info

**GET** `/api/info`

Returns API information and current configuration.

**Response:**

```json
{
  "version": "1.0.0",
  "endpoints": {
    "/api/ask": "Simple prompt execution",
    "/api/process": "Advanced prompt execution with all options",
    "/api/stream": "Streaming response",
    "/api/batch": "Batch processing multiple prompts"
  },
  "config": {
    "authEnabled": true,
    "maxPromptLength": 100000,
    "requestTimeout": 300000,
    "rateLimitWindow": 900000,
    "rateLimitMax": 100,
    "defaultModel": "sonnet"
  }
}
```

### Test Claude Code

**GET** `/api/test`

Verifies that Claude Code is working correctly.

**Response:**

```json
{
  "success": true,
  "message": "Claude Code is working correctly",
  "response": "Hello from Claude Code API!"
}
```

### Simple Ask

**POST** `/api/ask`

The recommended endpoint for most use cases. Executes a prompt with minimal configuration.

**Request Body:**

```json
{
  "prompt": "Summarize this text in 3 bullet points: [YOUR TEXT]",
  "outputFormat": "json",
  "model": "sonnet",
  "systemPrompt": "You are a helpful assistant"
}
```

**Parameters:**

- `prompt` (required): The prompt text to execute
- `outputFormat` (optional): Output format - `text`, `json`, or `stream-json` (default: `json`)
- `model` (optional): Model to use (default: `sonnet`)
- `systemPrompt` (optional): Custom system prompt

**Response:**

```json
{
  "response": "Your answer here..."
}
```

### Advanced Process

**POST** `/api/process`

Advanced execution with full access to Claude Code options.

**Request Body:**

```json
{
  "prompt": "Analyze this data",
  "outputFormat": "json",
  "model": "sonnet",
  "systemPrompt": "You are a data analyst",
  "appendSystemPrompt": "Always output valid JSON",
  "allowedTools": ["Bash", "Edit"],
  "disallowedTools": ["WebSearch"],
  "dangerouslySkipPermissions": false,
  "settings": {
    "customOption": "value"
  },
  "mcpConfig": ["/path/to/mcp-config.json"],
  "sessionId": "uuid-here",
  "continueSession": false,
  "resumeSession": null
}
```

**Parameters:**

- `prompt` (required): The prompt to execute
- `outputFormat`: Output format
- `model`: Model name or alias
- `systemPrompt`: Replace default system prompt
- `appendSystemPrompt`: Add to default system prompt
- `allowedTools`: Array of allowed tools
- `disallowedTools`: Array of disallowed tools
- `dangerouslySkipPermissions`: Skip permission checks (use with caution)
- `settings`: Additional settings object
- `mcpConfig`: Array of MCP config file paths
- `sessionId`: Specific session ID to use
- `continueSession`: Continue most recent conversation
- `resumeSession`: Resume specific session by ID

**Response:**

```json
{
  "success": true,
  "data": {
    "response": "..."
  },
  "metadata": {
    "model": "sonnet",
    "outputFormat": "json",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Streaming

**POST** `/api/stream`

Returns real-time streaming responses as NDJSON.

**Request Body:**

```json
{
  "prompt": "Write a long story",
  "model": "sonnet",
  "systemPrompt": "You are a creative writer",
  "includePartialMessages": true
}
```

**Response:**

Stream of newline-delimited JSON:

```
{"type":"content_block_start","content":{"type":"text","text":""}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":"Once"}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":" upon"}}
...
```

### Batch Processing

**POST** `/api/batch`

Process multiple prompts in sequence.

**Request Body:**

```json
{
  "prompts": [
    "Summarize: [text1]",
    "Analyze: [text2]",
    {
      "prompt": "Translate: [text3]",
      "model": "opus",
      "systemPrompt": "You are a translator"
    }
  ],
  "outputFormat": "json",
  "model": "sonnet",
  "systemPrompt": "Default system prompt"
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "index": 0,
      "success": true,
      "data": { "response": "..." }
    },
    {
      "index": 1,
      "success": true,
      "data": { "response": "..." }
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

## Authentication

When `AUTH_ENABLED=true`, the API uses HTTP Basic Authentication.

**Using curl:**

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

**Using JavaScript:**

```javascript
fetch("http://localhost:3000/api/ask", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Basic " + btoa("admin:changeme123"),
  },
  body: JSON.stringify({
    prompt: "Hello",
  }),
});
```

**Using n8n:**

1. Add HTTP Request node
2. Set Authentication to Basic Auth
3. Enter username and password
4. Configure request body as shown above

## n8n Integration Examples

### Text Summarization

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/ask",
  "authentication": "basicAuth",
  "bodyParameters": {
    "prompt": "Summarize in 3 points: {{$json.text}}",
    "outputFormat": "json"
  }
}
```

### Data Format Conversion

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/ask",
  "authentication": "basicAuth",
  "bodyParameters": {
    "prompt": "Convert this to JSON: {{$json.csvData}}",
    "outputFormat": "json",
    "systemPrompt": "Output only valid JSON"
  }
}
```

### Batch Analysis

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/batch",
  "authentication": "basicAuth",
  "bodyParameters": {
    "prompts": [
      "Analyze sentiment: {{$json.review1}}",
      "Analyze sentiment: {{$json.review2}}",
      "Analyze sentiment: {{$json.review3}}"
    ],
    "outputFormat": "json"
  }
}
```

### Streaming for Long Responses

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/stream",
  "authentication": "basicAuth",
  "bodyParameters": {
    "prompt": "Write detailed report: {{$json.topic}}",
    "includePartialMessages": true
  }
}
```

## Common Use Cases

### Text Summarization

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Summarize this article in 3 bullet points: [ARTICLE TEXT]",
    "outputFormat": "json"
  }'
```

### Data Extraction

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extract all email addresses from this text: [TEXT]",
    "outputFormat": "json",
    "systemPrompt": "Output as JSON array"
  }'
```

### Format Conversion

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Convert this CSV to structured JSON: [CSV]",
    "outputFormat": "json",
    "systemPrompt": "Output only valid JSON with proper types"
  }'
```

### Code Generation

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python function to calculate fibonacci",
    "outputFormat": "text"
  }'
```

### Data Analysis

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this sales data and provide insights: [DATA]",
    "outputFormat": "json",
    "model": "sonnet"
  }'
```

## Docker Deployment

Build the Docker image:

```bash
docker build -t claude-code-api .
```

Run the container:

```bash
docker run -d \
  -p 3000:3000 \
  -e AUTH_ENABLED=true \
  -e AUTH_USERS=admin:password \
  --name claude-api \
  claude-code-api
```

Using Docker Compose:

```bash
docker-compose up -d
```

## Security Best Practices

1. Always enable authentication in production environments
2. Use strong passwords with minimum 16 characters
3. Deploy behind HTTPS using a reverse proxy (nginx or Caddy)
4. Restrict CORS origins - avoid using `*` in production
5. Set appropriate rate limits based on your usage patterns
6. Monitor logs regularly for suspicious activity
7. Keep dependencies updated
8. Never hardcode secrets - use environment variables

## Configuration Reference

### Environment Variables

| Variable            | Default          | Description                             |
| ------------------- | ---------------- | --------------------------------------- |
| `PORT`              | `3000`           | Server port                             |
| `AUTH_ENABLED`      | `false`          | Enable authentication                   |
| `AUTH_USERS`        | `admin:changeme` | Comma-separated user:pass pairs         |
| `MAX_PROMPT_LENGTH` | `100000`         | Maximum prompt length in characters     |
| `REQUEST_TIMEOUT`   | `300000`         | Request timeout in milliseconds (5 min) |
| `RATE_LIMIT_WINDOW` | `900000`         | Rate limit window in ms (15 min)        |
| `RATE_LIMIT_MAX`    | `100`            | Max requests per window                 |
| `LOG_LEVEL`         | `info`           | Logging level (info/combined/none)      |
| `CORS_ORIGIN`       | `*`              | Allowed CORS origins                    |
| `DEFAULT_MODEL`     | `sonnet`         | Default Claude model                    |

## Testing

Run automated tests:

```bash
npm test
```

Manual testing steps:

**Check health:**

```bash
curl http://localhost:3000/health
```

**Test Claude Code:**

```bash
curl -u admin:password http://localhost:3000/api/test
```

**Execute a simple prompt:**

```bash
curl -u admin:password \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello"}'
```

## Monitoring and Logs

View logs using pm2:

```bash
pm2 logs claude-api
```

View logs using Docker:

```bash
docker logs -f claude-api
```

Direct log access:

```bash
tail -f logs/api.log
```

The API uses Morgan for request logging. Log format:

```
::1 - - [01/Jan/2024:12:00:00 +0000] "POST /api/ask HTTP/1.1" 200 123 "-" "curl/7.64.1"
```

## Troubleshooting

### Claude Code not found

Install globally:

```bash
npm install -g @anthropic-ai/claude-code
```

Or add to PATH:

```bash
export PATH=$PATH:/path/to/claude
```

### Authentication fails

- Verify `.env` file has correct format
- Check `AUTH_USERS=username:password` syntax
- Test without authentication first by setting `AUTH_ENABLED=false`

### Timeout errors

- Increase `REQUEST_TIMEOUT` in `.env`
- Verify Claude Code is responding
- Check network connectivity

### Rate limit reached

- Increase `RATE_LIMIT_MAX` value
- Extend `RATE_LIMIT_WINDOW` duration
- Consider using multiple API keys

## Advanced Usage

### Custom MCP Servers

```json
{
  "prompt": "Search the web for...",
  "mcpConfig": ["/path/to/mcp-config.json"],
  "allowedTools": ["WebSearch"]
}
```

### Session Management

```json
{
  "prompt": "Continue our discussion",
  "continueSession": true
}
```

### Tool Control

```json
{
  "prompt": "Edit this file",
  "allowedTools": ["Edit", "View"],
  "disallowedTools": ["Bash"]
}
```

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:

- Open an issue on GitHub
- Consult Claude Code documentation
- Review n8n integration guides

## Credits

Built with Express.js and Claude Code CLI by Anthropic, along with various open-source packages.
