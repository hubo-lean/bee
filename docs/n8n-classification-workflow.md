# n8n AI Classification Workflow Setup

This document describes how to configure n8n to process inbox items and classify them using AI (Claude/OpenAI).

## Prerequisites

- n8n instance running on your VPS
- OpenAI API key or Anthropic API key
- Bee application deployed with webhook endpoints

## Environment Variables

Set these environment variables in your n8n instance:

```bash
# Bee Application
BEE_CALLBACK_URL=https://your-bee-domain.com/api/webhooks/classification-complete
BEE_API_URL=https://your-bee-domain.com/api
BEE_WEBHOOK_SECRET=your-secure-webhook-secret-here

# AI Provider (choose one)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

## Workflow Overview

```
[Webhook Trigger] → [AI Classification] → [AI Action Extraction] → [AI Tag Extraction] → [Fetch Entities] → [Build Payload] → [Call Bee Callback]
```

## Node Configuration

### Node 1: Webhook Trigger

Receives classification requests from Bee application.

- **Node Type:** Webhook
- **HTTP Method:** POST
- **Path:** `classify-inbox-item`
- **Response Mode:** Immediately

Expected payload:
```json
{
  "inboxItemId": "uuid",
  "content": "text content to classify",
  "source": "manual|voice|email|forward",
  "type": "manual|image|voice|email|forward",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "callbackUrl": "https://bee.example.com/api/webhooks/classification-complete"
}
```

### Node 2: AI Classification (OpenAI/Claude)

Classify the content into categories with confidence score.

**System Prompt:**
```
You are a classification assistant. Analyze the following content and classify it into one of these categories:
- action: A task or to-do item that requires action
- note: General information, thoughts, or ideas to remember
- reference: Reference material, links, documentation, or resources to save
- meeting: Meeting notes, appointments, or calendar-related content
- unknown: Content that doesn't fit other categories

Respond in JSON format:
{
  "category": "action|note|reference|meeting|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification"
}
```

### Node 3: AI Action Extraction (OpenAI/Claude)

Extract action items from the content.

**System Prompt:**
```
Extract action items from the following content. For each action, identify:
- description: What needs to be done
- owner: Who should do it (if mentioned)
- dueDate: When it's due (if mentioned, ISO format)
- priority: urgent|high|normal|low based on context

Respond in JSON format:
{
  "actions": [
    {
      "description": "Action description",
      "confidence": 0.0-1.0,
      "owner": "Person name or null",
      "dueDate": "ISO date or null",
      "priority": "normal"
    }
  ]
}

If no actions are found, return: { "actions": [] }
```

### Node 4: AI Tag Extraction (OpenAI/Claude)

Extract relevant tags from the content.

**System Prompt:**
```
Extract tags from the following content. Identify:
- topic: Main topics or themes
- person: People mentioned
- project: Project names (will be linked if exists in system)
- area: Life/work areas (will be linked if exists in system)
- date: Dates mentioned (ISO format)
- location: Places mentioned

Respond in JSON format:
{
  "tags": [
    {
      "type": "topic|person|project|area|date|location",
      "value": "Tag value",
      "confidence": 0.0-1.0
    }
  ]
}
```

### Node 5: Fetch Projects (HTTP Request)

Lookup existing projects for entity linking.

- **Method:** GET
- **URL:** `{{ $env.BEE_API_URL }}/projects`
- **Continue on Fail:** true

### Node 6: Fetch Areas (HTTP Request)

Lookup existing areas for entity linking.

- **Method:** GET
- **URL:** `{{ $env.BEE_API_URL }}/areas`
- **Continue on Fail:** true

### Node 7: Build Final Payload (Code Node)

```javascript
const startTime = $('Webhook Trigger').first().json._startTime || Date.now();
const processingTimeMs = Date.now() - startTime;

const classification = $('AI Classification').first().json;
const actionsData = $('AI Action Extraction').first().json;
const tagsData = $('AI Tag Extraction').first().json;
const projects = $('Fetch Projects').first().json?.projects || [];
const areas = $('Fetch Areas').first().json?.areas || [];

// Link tags to entities
const linkedTags = (tagsData.tags || []).map(tag => {
  let linkedId = null;

  if (tag.type === 'project') {
    const match = projects.find(p =>
      p.name.toLowerCase() === tag.value.toLowerCase()
    );
    if (match) linkedId = match.id;
  }

  if (tag.type === 'area') {
    const match = areas.find(a =>
      a.name.toLowerCase() === tag.value.toLowerCase()
    );
    if (match) linkedId = match.id;
  }

  return {
    ...tag,
    linkedId
  };
});

// Add unique IDs to actions
const actionsWithIds = (actionsData.actions || []).map((action, index) => ({
  id: `${$('Webhook Trigger').first().json.inboxItemId}-action-${index}`,
  ...action
}));

return {
  inboxItemId: $('Webhook Trigger').first().json.inboxItemId,
  classification: {
    category: classification.category,
    confidence: classification.confidence,
    reasoning: classification.reasoning
  },
  extractedActions: actionsWithIds,
  tags: linkedTags,
  modelUsed: 'gpt-4o-mini', // or 'claude-3-haiku'
  processingTimeMs
};
```

### Node 8: Call Bee Callback (HTTP Request)

Send the classification results back to Bee.

- **Method:** POST
- **URL:** `{{ $('Webhook Trigger').first().json.callbackUrl }}`
- **Headers:**
  - `Content-Type`: `application/json`
  - `X-Webhook-Secret`: `{{ $env.BEE_WEBHOOK_SECRET }}`
- **Body:** `{{ JSON.stringify($json) }}`

## Complete Workflow JSON

Import this JSON directly into n8n:

```json
{
  "name": "Bee AI Classification",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "classify-inbox-item",
        "responseMode": "onReceived",
        "options": {}
      },
      "id": "webhook-trigger",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [250, 300],
      "webhookId": "bee-classify"
    },
    {
      "parameters": {
        "jsCode": "return { ...items[0].json, _startTime: Date.now() };"
      },
      "id": "set-start-time",
      "name": "Set Start Time",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "resource": "chat",
        "model": "gpt-4o-mini",
        "messages": {
          "values": [
            {
              "content": "You are a classification assistant. Analyze the following content and classify it into one of these categories:\n- action: A task or to-do item that requires action\n- note: General information, thoughts, or ideas to remember\n- reference: Reference material, links, documentation, or resources to save\n- meeting: Meeting notes, appointments, or calendar-related content\n- unknown: Content that doesn't fit other categories\n\nRespond in JSON format only:\n{\"category\": \"action|note|reference|meeting|unknown\", \"confidence\": 0.0-1.0, \"reasoning\": \"Brief explanation\"}"
            },
            {
              "role": "user",
              "content": "={{ $json.content }}"
            }
          ]
        },
        "options": {
          "temperature": 0.3,
          "responseFormat": "json_object"
        }
      },
      "id": "ai-classification",
      "name": "AI Classification",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 1,
      "position": [650, 200],
      "credentials": {
        "openAiApi": {
          "id": "OPENAI_CREDENTIAL_ID",
          "name": "OpenAI API"
        }
      }
    },
    {
      "parameters": {
        "resource": "chat",
        "model": "gpt-4o-mini",
        "messages": {
          "values": [
            {
              "content": "Extract action items from the following content. For each action, identify description, owner (if mentioned), dueDate (ISO format if mentioned), and priority (urgent|high|normal|low).\n\nRespond in JSON format only:\n{\"actions\": [{\"description\": \"...\", \"confidence\": 0.0-1.0, \"owner\": null, \"dueDate\": null, \"priority\": \"normal\"}]}\n\nIf no actions found, return: {\"actions\": []}"
            },
            {
              "role": "user",
              "content": "={{ $('Set Start Time').first().json.content }}"
            }
          ]
        },
        "options": {
          "temperature": 0.3,
          "responseFormat": "json_object"
        }
      },
      "id": "ai-action-extraction",
      "name": "AI Action Extraction",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 1,
      "position": [650, 400],
      "credentials": {
        "openAiApi": {
          "id": "OPENAI_CREDENTIAL_ID",
          "name": "OpenAI API"
        }
      }
    },
    {
      "parameters": {
        "resource": "chat",
        "model": "gpt-4o-mini",
        "messages": {
          "values": [
            {
              "content": "Extract tags from the following content. Tag types: topic, person, project, area, date (ISO format), location.\n\nRespond in JSON format only:\n{\"tags\": [{\"type\": \"topic|person|project|area|date|location\", \"value\": \"...\", \"confidence\": 0.0-1.0}]}"
            },
            {
              "role": "user",
              "content": "={{ $('Set Start Time').first().json.content }}"
            }
          ]
        },
        "options": {
          "temperature": 0.3,
          "responseFormat": "json_object"
        }
      },
      "id": "ai-tag-extraction",
      "name": "AI Tag Extraction",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 1,
      "position": [650, 600],
      "credentials": {
        "openAiApi": {
          "id": "OPENAI_CREDENTIAL_ID",
          "name": "OpenAI API"
        }
      }
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $env.BEE_API_URL }}/projects",
        "options": {
          "timeout": 5000
        }
      },
      "id": "fetch-projects",
      "name": "Fetch Projects",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [900, 200],
      "continueOnFail": true
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $env.BEE_API_URL }}/areas",
        "options": {
          "timeout": 5000
        }
      },
      "id": "fetch-areas",
      "name": "Fetch Areas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [900, 400],
      "continueOnFail": true
    },
    {
      "parameters": {
        "mode": "raw",
        "jsonOutput": "={\n  \"classification\": {{ $('AI Classification').first().json.message.content }},\n  \"actions\": {{ $('AI Action Extraction').first().json.message.content }},\n  \"tags\": {{ $('AI Tag Extraction').first().json.message.content }},\n  \"projects\": {{ JSON.stringify($('Fetch Projects').first().json.projects || []) }},\n  \"areas\": {{ JSON.stringify($('Fetch Areas').first().json.areas || []) }},\n  \"startTime\": {{ $('Set Start Time').first().json._startTime }},\n  \"inboxItemId\": \"{{ $('Set Start Time').first().json.inboxItemId }}\",\n  \"callbackUrl\": \"{{ $('Set Start Time').first().json.callbackUrl }}\"\n}",
        "options": {}
      },
      "id": "merge-results",
      "name": "Merge Results",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [1100, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = items[0].json;\nconst processingTimeMs = Date.now() - data.startTime;\n\nconst classification = typeof data.classification === 'string' \n  ? JSON.parse(data.classification) \n  : data.classification;\nconst actionsData = typeof data.actions === 'string' \n  ? JSON.parse(data.actions) \n  : data.actions;\nconst tagsData = typeof data.tags === 'string' \n  ? JSON.parse(data.tags) \n  : data.tags;\nconst projects = data.projects || [];\nconst areas = data.areas || [];\n\n// Link tags to entities\nconst linkedTags = (tagsData.tags || []).map(tag => {\n  let linkedId = null;\n  \n  if (tag.type === 'project') {\n    const match = projects.find(p => \n      p.name.toLowerCase() === tag.value.toLowerCase()\n    );\n    if (match) linkedId = match.id;\n  }\n  \n  if (tag.type === 'area') {\n    const match = areas.find(a => \n      a.name.toLowerCase() === tag.value.toLowerCase()\n    );\n    if (match) linkedId = match.id;\n  }\n  \n  return { ...tag, linkedId };\n});\n\n// Add unique IDs to actions\nconst actionsWithIds = (actionsData.actions || []).map((action, index) => ({\n  id: `${data.inboxItemId}-action-${index}`,\n  ...action\n}));\n\nreturn {\n  json: {\n    inboxItemId: data.inboxItemId,\n    callbackUrl: data.callbackUrl,\n    classification: {\n      category: classification.category,\n      confidence: classification.confidence,\n      reasoning: classification.reasoning\n    },\n    extractedActions: actionsWithIds,\n    tags: linkedTags,\n    modelUsed: 'gpt-4o-mini',\n    processingTimeMs\n  }\n};"
      },
      "id": "build-payload",
      "name": "Build Payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1300, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.callbackUrl }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "X-Webhook-Secret",
              "value": "={{ $env.BEE_WEBHOOK_SECRET }}"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"inboxItemId\": \"{{ $json.inboxItemId }}\",\n  \"classification\": {{ JSON.stringify($json.classification) }},\n  \"extractedActions\": {{ JSON.stringify($json.extractedActions) }},\n  \"tags\": {{ JSON.stringify($json.tags) }},\n  \"modelUsed\": \"{{ $json.modelUsed }}\",\n  \"processingTimeMs\": {{ $json.processingTimeMs }}\n}",
        "options": {
          "timeout": 10000
        }
      },
      "id": "call-callback",
      "name": "Call Bee Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [1500, 300]
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Set Start Time",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Start Time": {
      "main": [
        [
          {
            "node": "AI Classification",
            "type": "main",
            "index": 0
          },
          {
            "node": "AI Action Extraction",
            "type": "main",
            "index": 0
          },
          {
            "node": "AI Tag Extraction",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Classification": {
      "main": [
        [
          {
            "node": "Fetch Projects",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Action Extraction": {
      "main": [
        [
          {
            "node": "Fetch Areas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Tag Extraction": {
      "main": [
        [
          {
            "node": "Merge Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Projects": {
      "main": [
        [
          {
            "node": "Merge Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Areas": {
      "main": [
        [
          {
            "node": "Merge Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Merge Results": {
      "main": [
        [
          {
            "node": "Build Payload",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Build Payload": {
      "main": [
        [
          {
            "node": "Call Bee Callback",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": [],
  "triggerCount": 0,
  "pinData": {}
}
```

## Alternative: Claude (Anthropic) Configuration

If using Claude instead of OpenAI, replace the AI nodes with:

```json
{
  "parameters": {
    "model": "claude-3-haiku-20240307",
    "messages": {
      "values": [
        {
          "role": "user",
          "content": "You are a classification assistant. Analyze this content and respond with JSON only: {\"category\": \"action|note|reference|meeting|unknown\", \"confidence\": 0.0-1.0, \"reasoning\": \"...\"}\n\nContent: {{ $json.content }}"
        }
      ]
    },
    "options": {
      "temperature": 0.3,
      "maxTokens": 500
    }
  },
  "type": "@n8n/n8n-nodes-langchain.anthropic",
  "credentials": {
    "anthropicApi": {
      "id": "ANTHROPIC_CREDENTIAL_ID",
      "name": "Anthropic API"
    }
  }
}
```

## Deployment Steps

1. **Import Workflow**
   - Open n8n
   - Go to Workflows → Import
   - Paste the JSON above
   - Click Import

2. **Configure Credentials**
   - Go to Settings → Credentials
   - Add OpenAI or Anthropic credentials
   - Update the credential IDs in the workflow nodes

3. **Set Environment Variables**
   - In n8n settings or .env file, set:
     - `BEE_API_URL`
     - `BEE_WEBHOOK_SECRET`

4. **Update Bee Configuration**
   - Set `N8N_CLASSIFY_WEBHOOK_URL` to your n8n webhook URL
   - Set `N8N_WEBHOOK_SECRET` to match `BEE_WEBHOOK_SECRET`

5. **Activate Workflow**
   - Toggle the workflow to active
   - Test with a sample inbox item

## Testing

1. Send a test request to the webhook:

```bash
curl -X POST https://your-n8n.com/webhook/classify-inbox-item \
  -H "Content-Type: application/json" \
  -d '{
    "inboxItemId": "test-123",
    "content": "Remember to call John about the project deadline next Tuesday",
    "source": "manual",
    "type": "manual",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "callbackUrl": "https://your-bee.com/api/webhooks/classification-complete"
  }'
```

2. Expected classification result:
```json
{
  "inboxItemId": "test-123",
  "classification": {
    "category": "action",
    "confidence": 0.92,
    "reasoning": "Contains a clear task: calling John about project deadline"
  },
  "extractedActions": [
    {
      "id": "test-123-action-0",
      "description": "Call John about the project deadline",
      "confidence": 0.95,
      "owner": "John",
      "dueDate": "2024-01-09T00:00:00.000Z",
      "priority": "high"
    }
  ],
  "tags": [
    { "type": "person", "value": "John", "confidence": 0.98 },
    { "type": "topic", "value": "project deadline", "confidence": 0.85 },
    { "type": "date", "value": "2024-01-09", "confidence": 0.90 }
  ],
  "modelUsed": "gpt-4o-mini",
  "processingTimeMs": 2150
}
```

## Troubleshooting

### Common Issues

1. **Webhook not receiving requests**
   - Verify the webhook URL in Bee's `N8N_CLASSIFY_WEBHOOK_URL`
   - Check n8n is accessible from Bee's server

2. **AI response parsing errors**
   - Ensure `responseFormat: "json_object"` is set for OpenAI
   - Check AI prompts specify JSON-only responses

3. **Callback failing with 401**
   - Verify `BEE_WEBHOOK_SECRET` matches in both systems
   - Check the secret is being sent in `X-Webhook-Secret` header

4. **Entity linking not working**
   - Verify `/api/projects` and `/api/areas` endpoints are accessible
   - Check projects/areas exist in the database

### Debug Mode

Add a Set node before the callback to log the payload:

```javascript
console.log('Final payload:', JSON.stringify($json, null, 2));
return $json;
```

## Performance Optimization

For high-volume usage:

1. **Parallel AI Calls**: The workflow already runs classification, action extraction, and tag extraction in parallel.

2. **Caching**: Consider caching project/area lists if they don't change frequently.

3. **Model Selection**: Use `gpt-4o-mini` or `claude-3-haiku` for fast, cost-effective classification.

4. **Batch Processing**: For bulk imports, consider a separate batch workflow.
