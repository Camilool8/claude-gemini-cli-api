# API Examples

Practical examples for using the Claude Code API.

## Quick Test Commands

### Health Check

```bash
curl http://localhost:3000/health
```

### Simple Ask (with authentication)

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello!",
    "outputFormat": "text"
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

### Streaming Response

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short story about a robot",
    "includePartialMessages": true
  }'
```

### Advanced Process with Options

```bash
curl -u admin:changeme123 \
  -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this data: [1,2,3,4,5,6,7,8,9,10]",
    "outputFormat": "json",
    "model": "sonnet",
    "systemPrompt": "You are a data analyst",
    "appendSystemPrompt": "Always provide statistical insights"
  }'
```

## JavaScript/Node.js Examples

### Simple Request

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
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
```

### Async/Await

```javascript
async function askClaude(prompt) {
  const response = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from("admin:changeme123").toString("base64"),
    },
    body: JSON.stringify({ prompt, outputFormat: "json" }),
  });

  return await response.json();
}

// Usage
askClaude("Explain quantum computing in simple terms")
  .then((result) => console.log(result))
  .catch((err) => console.error(err));
```

## Python Examples

### Simple Request

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
print(response.json())
```

### Batch Processing

```python
import requests
from requests.auth import HTTPBasicAuth

url = 'http://localhost:3000/api/batch'
auth = HTTPBasicAuth('admin', 'changeme123')

data = {
    'prompts': [
        'Summarize: AI is transforming industries',
        'Translate to Spanish: Hello world',
        'Calculate: 123 * 456'
    ],
    'outputFormat': 'json'
}

response = requests.post(url, json=data, auth=auth)
result = response.json()

for item in result['results']:
    print(f"Result {item['index']}: {item['data']}")
```

## n8n Workflow Examples

### HTTP Request Node Configuration

**Simple Query**

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
