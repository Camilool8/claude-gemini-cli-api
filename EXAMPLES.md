# API Examples

Practical examples for using the AI CLI API (supports both Claude Code and Gemini CLI).

## Quick Test Commands

### Health Check

```bash
curl http://localhost:3000/health
```

### Test Claude Code CLI

```bash
curl -u admin:changeme123 http://localhost:3000/api/test?cli=claude
```

### Test Gemini CLI

```bash
curl -u admin:changeme123 http://localhost:3000/api/test?cli=gemini
```

### Simple Ask (with authentication, using default CLI)

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello!",
    "outputFormat": "text"
  }'
```

### Simple Ask with Claude Code

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello!",
    "outputFormat": "text",
    "cli": "claude"
  }'
```

### Simple Ask with Gemini CLI

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello!",
    "outputFormat": "text",
    "cli": "gemini"
  }'
```

### Text Summarization

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Summarize the following in 3 bullet points: Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of intelligent agents.",
    "outputFormat": "json",
    "systemPrompt": "You are a helpful summarization assistant."
  }'
```

### Data Extraction

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extract all email addresses from this text: Contact us at support@example.com or sales@example.org for more info. You can also reach admin@test.com",
    "outputFormat": "json",
    "systemPrompt": "Output only a JSON array of email addresses."
  }'
```

### JSON Conversion

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Convert this CSV to JSON:\nname,age,city\nJohn,30,NYC\nJane,25,LA\nBob,35,Chicago",
    "outputFormat": "json",
    "systemPrompt": "Output valid JSON array with objects."
  }'
```

### Code Generation

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python function that calculates the factorial of a number",
    "outputFormat": "text"
  }'
```

### Batch Processing

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the capital of France?",
      "What is 15 * 23?",
      "Name 3 programming languages"
    ],
    "outputFormat": "text"
  }'
```

### Streaming Response (default CLI)

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short story about a robot",
    "includePartialMessages": true
  }'
```

### Streaming with Gemini CLI

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short story about a robot",
    "cli": "gemini"
  }'
```

### Advanced Process with Options (Claude)

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this data: [1,2,3,4,5,6,7,8,9,10]",
    "outputFormat": "json",
    "model": "sonnet",
    "cli": "claude",
    "systemPrompt": "You are a data analyst",
    "appendSystemPrompt": "Always provide statistical insights"
  }'
```

### Advanced Process with Gemini

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this data: [1,2,3,4,5,6,7,8,9,10]",
    "outputFormat": "json",
    "model": "gemini-2.5-flash",
    "cli": "gemini",
    "systemPrompt": "You are a data analyst. Always provide statistical insights"
  }'
```

### Automatic Fallback Example

The API automatically falls back to the alternate CLI if the primary fails:

```bash
# If Claude fails, automatically tries Gemini
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "outputFormat": "json",
    "cli": "claude"
  }'
```

Response will include metadata indicating which CLI was used:

```json
{
  "response": "Quantum computing is...",
  "_meta": {
    "usedCLI": "gemini",
    "fallbackUsed": true
  }
}
```

## JavaScript/Node.js Examples

### Simple Request (default CLI)

```javascript
const fetch = require("node-fetch");

const apiUrl = "http://localhost:3000/api/ask";
const auth = Buffer.from("admin:changeme123").toString("base64");

fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${auth}`,
  },
  body: JSON.stringify({
    prompt: "What is the meaning of life?",
    outputFormat: "text",
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data);
    console.log("Used CLI:", data._meta?.usedCLI);
  })
  .catch((err) => console.error(err));
```

### Request with Specific CLI

```javascript
const fetch = require("node-fetch");

const apiUrl = "http://localhost:3000/api/ask";
const auth = Buffer.from("admin:changeme123").toString("base64");

fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${auth}`,
  },
  body: JSON.stringify({
    prompt: "Explain AI in simple terms",
    outputFormat: "json",
    cli: "gemini", // Specify Gemini CLI
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data);
    if (data._meta?.fallbackUsed) {
      console.log("Fallback was used to", data._meta.usedCLI);
    }
  })
  .catch((err) => console.error(err));
```

### Async/Await with CLI Selection

```javascript
async function askAI(prompt, cli = null) {
  const body = { prompt, outputFormat: "json" };
  if (cli) body.cli = cli;

  const response = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from("admin:changeme123").toString("base64"),
    },
    body: JSON.stringify(body),
  });

  return await response.json();
}

// Usage with default CLI
askAI("Explain quantum computing in simple terms")
  .then((result) => {
    console.log(result);
    console.log("Used CLI:", result._meta?.usedCLI);
  })
  .catch((err) => console.error(err));

// Usage with specific CLI
askAI("Write a haiku about coding", "gemini")
  .then((result) => console.log(result))
  .catch((err) => console.error(err));
```

## Python Examples

### Simple Request (default CLI)

```python
import requests
from requests.auth import HTTPBasicAuth

url = 'http://localhost:3000/api/ask'
auth = HTTPBasicAuth('admin', 'changeme123')

data = {
    'prompt': 'What is machine learning?',
    'outputFormat': 'text'
}

response = requests.post(url, json=data, auth=auth)
result = response.json()
print(result)
print(f"Used CLI: {result.get('_meta', {}).get('usedCLI', 'unknown')}")
```

### Request with Specific CLI

```python
import requests
from requests.auth import HTTPBasicAuth

url = 'http://localhost:3000/api/ask'
auth = HTTPBasicAuth('admin', 'changeme123')

# Use Gemini CLI
data = {
    'prompt': 'Explain neural networks',
    'outputFormat': 'json',
    'cli': 'gemini'
}

response = requests.post(url, json=data, auth=auth)
result = response.json()
print(result)

if result.get('_meta', {}).get('fallbackUsed'):
    print(f"Fallback was used! Actual CLI: {result['_meta']['usedCLI']}")
```

### Batch Processing with Mixed CLIs

```python
import requests
from requests.auth import HTTPBasicAuth

url = 'http://localhost:3000/api/batch'
auth = HTTPBasicAuth('admin', 'changeme123')

# Mix of string prompts and detailed prompt objects
data = {
    'prompts': [
        'Summarize: AI is transforming industries',
        {
            'prompt': 'Translate to Spanish: Hello world',
            'cli': 'gemini'
        },
        {
            'prompt': 'Calculate: 123 * 456',
            'cli': 'claude'
        }
    ],
    'outputFormat': 'json'
}

response = requests.post(url, json=data, auth=auth)
result = response.json()

for item in result['results']:
    print(f"Result {item['index']}: {item['data']}")
    print(f"  Used CLI: {item['usedCLI']}, Fallback: {item['fallbackUsed']}")
```

## n8n Workflow Examples

### HTTP Request Node Configuration

**Simple Query (default CLI)**

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/ask",
  "authentication": "basicAuth",
  "basicAuth": {
    "user": "admin",
    "password": "changeme123"
  },
  "body": {
    "prompt": "{{$json.userQuery}}",
    "outputFormat": "json"
  }
}
```

**Query with Specific CLI**

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/ask",
  "authentication": "basicAuth",
  "basicAuth": {
    "user": "admin",
    "password": "changeme123"
  },
  "body": {
    "prompt": "{{$json.userQuery}}",
    "outputFormat": "json",
    "cli": "gemini"
  }
}
```

**Data Processing**

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/ask",
  "authentication": "basicAuth",
  "basicAuth": {
    "user": "admin",
    "password": "changeme123"
  },
  "body": {
    "prompt": "Convert this to JSON format: {{$json.csvData}}",
    "outputFormat": "json",
    "systemPrompt": "You are a data transformation expert. Output only valid JSON."
  }
}
```

**Batch Processing**

```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/batch",
  "authentication": "basicAuth",
  "basicAuth": {
    "user": "admin",
    "password": "changeme123"
  },
  "body": {
    "prompts": "{{$json.questions}}",
    "outputFormat": "json",
    "model": "sonnet"
  }
}
```
