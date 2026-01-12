# n8n AI Classification Workflow Setup

This document describes how to configure n8n to process inbox items and classify them using AI (Claude/OpenAI).

## Prerequisites

- n8n instance running on your VPS
- OpenAI API key or Anthropic API key
- Supabase project (for entity linking - optional)

## Environment Variables

Set these environment variables in your n8n instance:

```bash
# AI Provider (choose one)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (optional - for entity linking)
SUPABASE_URL=https://ltugyvocpmdjlnzfjbat.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

**Note:** The callback URL and webhook secret are passed in each request from Bee, so no additional Bee configuration is needed in n8n.

## Workflow Overview

```
[Webhook Trigger] → [Respond to Webhook (ACK)] → [AI Classification] → [HTTP Request (Callback)]
```

The workflow uses the **Respond to Webhook** node to immediately acknowledge the request (HTTP 202), then processes asynchronously and calls back to Bee when complete.

## Bee App Configuration

Add to your `.env`:

```bash
# n8n webhook URL
N8N_CLASSIFY_WEBHOOK_URL=https://your-n8n.com/webhook/classify-inbox-item

# Optional: shared secret for webhook auth (leave empty for no auth)
# N8N_WEBHOOK_SECRET=your-secret
```

---

## Complete E2E Workflow JSON (Full Features)

**Import this directly into n8n** - includes:
- Immediate acknowledgment via Respond to Webhook node (HTTP 202)
- Classification, action extraction, tag extraction (parallel AI calls)
- Entity linking with Supabase
- Error handling with callback

```json
{
  "name": "Bee AI Classification (Full)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "classify-inbox-item",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "d2c5b8a1-1234-4567-8901-abcdef123456",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [250, 300],
      "webhookId": "bee-classify"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"acknowledged\": true, \"inboxItemId\": $json.inboxItemId, \"message\": \"Classification started\" } }}",
        "options": {
          "responseCode": 202
        }
      },
      "id": "e1f2a3b4-2345-5678-9012-bcdef1234567",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [450, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Bee AI Classification - Full E2E Workflow\n// Performs: Classification, Action Extraction, Tag Extraction, Entity Linking\n\nconst input = $input.first().json;\nconst startTime = Date.now();\n\n// Validate required fields\nif (!input.inboxItemId || !input.content || !input.callbackUrl) {\n  throw new Error('Missing required fields: inboxItemId, content, or callbackUrl');\n}\n\n// System prompts for each AI task\nconst CLASSIFICATION_PROMPT = `You are a classification assistant for a personal productivity app.\nClassify the content into ONE of these categories:\n- action: A task, to-do item, or something that requires action\n- note: General information, ideas, thoughts, or observations\n- reference: Material to save for later reference (articles, links, quotes)\n- meeting: Meeting notes, calendar-related, or scheduling content\n- unknown: Doesn't fit other categories\n\nRespond ONLY with valid JSON:\n{\"category\": \"action|note|reference|meeting|unknown\", \"confidence\": 0.0-1.0, \"reasoning\": \"brief explanation\"}`;\n\nconst ACTIONS_PROMPT = `Extract action items from the content. An action is a task that needs to be done.\nFor each action, identify:\n- description: What needs to be done\n- confidence: How confident you are this is an action (0.0-1.0)\n- owner: Person responsible (null if not mentioned)\n- dueDate: Due date in ISO format (null if not mentioned)\n- priority: urgent, high, normal, or low (default: normal)\n\nRespond ONLY with valid JSON:\n{\"actions\": [{\"description\": \"...\", \"confidence\": 0.0-1.0, \"owner\": null, \"dueDate\": null, \"priority\": \"normal\"}]}\n\nIf no actions found, return: {\"actions\": []}`;\n\nconst TAGS_PROMPT = `Extract relevant tags from the content.\nTag types:\n- topic: Subject matter or theme\n- person: Names of people mentioned\n- project: Project names mentioned\n- area: Areas of responsibility (work, health, finance, etc.)\n- date: Dates or time references\n- location: Places mentioned\n\nRespond ONLY with valid JSON:\n{\"tags\": [{\"type\": \"topic|person|project|area|date|location\", \"value\": \"...\", \"confidence\": 0.0-1.0}]}\n\nIf no tags found, return: {\"tags\": []}`;\n\n// Helper function to call OpenAI\nasync function callOpenAI(systemPrompt, userContent) {\n  const response = await fetch('https://api.openai.com/v1/chat/completions', {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'Authorization': `Bearer ${$env.OPENAI_API_KEY}`\n    },\n    body: JSON.stringify({\n      model: 'gpt-4o-mini',\n      messages: [\n        { role: 'system', content: systemPrompt },\n        { role: 'user', content: userContent }\n      ],\n      temperature: 0.3,\n      response_format: { type: 'json_object' }\n    })\n  });\n  \n  if (!response.ok) {\n    const error = await response.text();\n    throw new Error(`OpenAI API error: ${response.status} - ${error}`);\n  }\n  \n  const result = await response.json();\n  return JSON.parse(result.choices[0].message.content);\n}\n\n// Run all AI calls in parallel for speed\nconst [classification, actionsResult, tagsResult] = await Promise.all([\n  callOpenAI(CLASSIFICATION_PROMPT, input.content),\n  callOpenAI(ACTIONS_PROMPT, input.content),\n  callOpenAI(TAGS_PROMPT, input.content)\n]);\n\n// Fetch entities from Supabase for linking (optional)\nlet projects = [];\nlet areas = [];\n\nif ($env.SUPABASE_URL && $env.SUPABASE_SERVICE_KEY) {\n  try {\n    const [projectsRes, areasRes] = await Promise.all([\n      fetch(`${$env.SUPABASE_URL}/rest/v1/Project?select=id,name&status=eq.active`, {\n        headers: {\n          'apikey': $env.SUPABASE_SERVICE_KEY,\n          'Authorization': `Bearer ${$env.SUPABASE_SERVICE_KEY}`\n        }\n      }),\n      fetch(`${$env.SUPABASE_URL}/rest/v1/Area?select=id,name`, {\n        headers: {\n          'apikey': $env.SUPABASE_SERVICE_KEY,\n          'Authorization': `Bearer ${$env.SUPABASE_SERVICE_KEY}`\n        }\n      })\n    ]);\n    \n    if (projectsRes.ok) projects = await projectsRes.json();\n    if (areasRes.ok) areas = await areasRes.json();\n  } catch (e) {\n    // Supabase fetch failed, continue without entity linking\n    console.log('Supabase fetch failed:', e.message);\n  }\n}\n\n// Link tags to entities (fuzzy match by name)\nconst linkedTags = (tagsResult.tags || []).map(tag => {\n  let linkedId = null;\n  \n  if (tag.type === 'project' && projects.length > 0) {\n    const match = projects.find(p => \n      p.name.toLowerCase().includes(tag.value.toLowerCase()) ||\n      tag.value.toLowerCase().includes(p.name.toLowerCase())\n    );\n    if (match) linkedId = match.id;\n  }\n  \n  if (tag.type === 'area' && areas.length > 0) {\n    const match = areas.find(a => \n      a.name.toLowerCase().includes(tag.value.toLowerCase()) ||\n      tag.value.toLowerCase().includes(a.name.toLowerCase())\n    );\n    if (match) linkedId = match.id;\n  }\n  \n  return { ...tag, linkedId };\n});\n\n// Add unique IDs to actions\nconst actionsWithIds = (actionsResult.actions || []).map((action, i) => ({\n  id: `${input.inboxItemId}-action-${i}`,\n  ...action\n}));\n\n// Return as array (n8n Code node requirement)\nreturn [{\n  json: {\n    inboxItemId: input.inboxItemId,\n    callbackUrl: input.callbackUrl,\n    classification: {\n      category: classification.category,\n      confidence: classification.confidence,\n      reasoning: classification.reasoning\n    },\n    extractedActions: actionsWithIds,\n    tags: linkedTags,\n    modelUsed: 'gpt-4o-mini',\n    processingTimeMs: Date.now() - startTime\n  }\n}];"
      },
      "id": "a1b2c3d4-5678-9012-3456-789012345678",
      "name": "AI Classification",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
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
            }
          ]
        },
        "sendBody": true,
        "contentType": "json",
        "specifyBody": "json",
        "jsonBody": "={\n  \"inboxItemId\": \"{{ $json.inboxItemId }}\",\n  \"classification\": {{ JSON.stringify($json.classification) }},\n  \"extractedActions\": {{ JSON.stringify($json.extractedActions) }},\n  \"tags\": {{ JSON.stringify($json.tags) }},\n  \"modelUsed\": \"{{ $json.modelUsed }}\",\n  \"processingTimeMs\": {{ $json.processingTimeMs }}\n}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "b2c3d4e5-6789-0123-4567-890123456789",
      "name": "Call Bee Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "// Error handler - builds error response for callback\nconst input = $input.first().json;\nconst errorInfo = $execution?.error || { message: 'Unknown error occurred' };\n\nreturn [{\n  json: {\n    inboxItemId: input.inboxItemId || 'unknown',\n    callbackUrl: input.callbackUrl,\n    error: errorInfo.message || String(errorInfo),\n    classification: {\n      category: 'unknown',\n      confidence: 0,\n      reasoning: `Classification failed: ${errorInfo.message || 'Unknown error'}`\n    },\n    extractedActions: [],\n    tags: [],\n    modelUsed: 'error',\n    processingTimeMs: 0\n  }\n}];"
      },
      "id": "c3d4e5f6-7890-1234-5678-901234567890",
      "name": "Handle Error",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 500]
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
            }
          ]
        },
        "sendBody": true,
        "contentType": "json",
        "specifyBody": "json",
        "jsonBody": "={\n  \"inboxItemId\": \"{{ $json.inboxItemId }}\",\n  \"classification\": {{ JSON.stringify($json.classification) }},\n  \"extractedActions\": {{ JSON.stringify($json.extractedActions) }},\n  \"tags\": {{ JSON.stringify($json.tags) }},\n  \"modelUsed\": \"{{ $json.modelUsed }}\",\n  \"processingTimeMs\": {{ $json.processingTimeMs }},\n  \"error\": \"{{ $json.error }}\"\n}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "d4e5f6a7-8901-2345-6789-012345678901",
      "name": "Send Error Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [850, 500]
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Respond to Webhook": {
      "main": [
        [
          {
            "node": "AI Classification",
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
            "node": "Call Bee Callback",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Handle Error": {
      "main": [
        [
          {
            "node": "Send Error Callback",
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
  "pinData": {}
}
```

### How to Import

1. Open your n8n instance
2. Go to **Workflows** → **Import from File** (or paste JSON)
3. Copy the JSON above and paste it
4. Click **Import**
5. Set up your credentials:
   - Add `OPENAI_API_KEY` in n8n Settings → Environment Variables
   - Optionally add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` for entity linking
6. **Activate** the workflow

### Key Node Configuration

| Node | Type Version | Purpose | Key Settings |
|------|--------------|---------|--------------|
| **Webhook Trigger** | 2.1 | Receives POST from Bee | `responseMode: "responseNode"` |
| **Respond to Webhook** | 1.5 | Immediately acknowledges | Returns 202 with `{ acknowledged: true }` |
| **AI Classification** | 2 | Processes content | Parallel OpenAI calls, returns array |
| **Call Bee Callback** | 4.3 | Sends results back | POSTs to `callbackUrl` |

---

## Minimal Workflow JSON (Classification Only)

If you only need basic classification without actions/tags:

```json
{
  "name": "Bee AI Classification (Minimal)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "classify-inbox-item",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-trigger",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [250, 300],
      "webhookId": "bee-classify"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"acknowledged\": true, \"inboxItemId\": $json.inboxItemId } }}",
        "options": {
          "responseCode": 202
        }
      },
      "id": "respond-ack",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [450, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const input = $input.first().json;\nconst startTime = Date.now();\n\nif (!input.content || !input.callbackUrl) {\n  throw new Error('Missing content or callbackUrl');\n}\n\nconst response = await fetch('https://api.openai.com/v1/chat/completions', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': `Bearer ${$env.OPENAI_API_KEY}`\n  },\n  body: JSON.stringify({\n    model: 'gpt-4o-mini',\n    messages: [\n      {\n        role: 'system',\n        content: 'You are a classification assistant. Classify content into: action (task/to-do), note (information/ideas), reference (save for later), meeting (calendar-related), unknown. Respond in JSON: {\"category\": \"...\", \"confidence\": 0.0-1.0, \"reasoning\": \"...\"}'\n      },\n      { role: 'user', content: input.content }\n    ],\n    temperature: 0.3,\n    response_format: { type: 'json_object' }\n  })\n});\n\nif (!response.ok) {\n  throw new Error(`OpenAI error: ${response.status}`);\n}\n\nconst result = await response.json();\nconst classification = JSON.parse(result.choices[0].message.content);\n\nreturn [{\n  json: {\n    inboxItemId: input.inboxItemId,\n    callbackUrl: input.callbackUrl,\n    classification: {\n      category: classification.category,\n      confidence: classification.confidence,\n      reasoning: classification.reasoning\n    },\n    modelUsed: 'gpt-4o-mini',\n    processingTimeMs: Date.now() - startTime\n  }\n}];"
      },
      "id": "ai-classify",
      "name": "AI Classification",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.callbackUrl }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "contentType": "json",
        "specifyBody": "json",
        "jsonBody": "={\n  \"inboxItemId\": \"{{ $json.inboxItemId }}\",\n  \"classification\": {{ JSON.stringify($json.classification) }},\n  \"modelUsed\": \"{{ $json.modelUsed }}\",\n  \"processingTimeMs\": {{ $json.processingTimeMs }}\n}"
      },
      "id": "call-callback",
      "name": "Call Bee Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]]
    },
    "Respond to Webhook": {
      "main": [[{ "node": "AI Classification", "type": "main", "index": 0 }]]
    },
    "AI Classification": {
      "main": [[{ "node": "Call Bee Callback", "type": "main", "index": 0 }]]
    }
  },
  "settings": { "executionOrder": "v1" }
}
```

---

## Incoming Payload (from Bee)

When Bee captures an inbox item, it sends:

```json
{
  "inboxItemId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Remember to call John about the project deadline next Tuesday",
  "source": "manual",
  "type": "manual",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "callbackUrl": "https://your-bee.com/api/webhooks/classification-complete"
}
```

## Immediate Response (from Respond to Webhook)

Bee receives immediately (HTTP 202):

```json
{
  "acknowledged": true,
  "inboxItemId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Classification started"
}
```

## Final Callback Payload (to Bee)

After processing, n8n POSTs to callbackUrl:

```json
{
  "inboxItemId": "550e8400-e29b-41d4-a716-446655440000",
  "classification": {
    "category": "action",
    "confidence": 0.92,
    "reasoning": "Contains a clear task: calling John about project deadline"
  },
  "extractedActions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000-action-0",
      "description": "Call John about project deadline",
      "confidence": 0.95,
      "owner": "John",
      "dueDate": "2024-01-21T00:00:00.000Z",
      "priority": "normal"
    }
  ],
  "tags": [
    { "type": "person", "value": "John", "confidence": 0.98, "linkedId": null },
    { "type": "date", "value": "next Tuesday", "confidence": 0.90, "linkedId": null },
    { "type": "topic", "value": "project deadline", "confidence": 0.85, "linkedId": null }
  ],
  "modelUsed": "gpt-4o-mini",
  "processingTimeMs": 1250
}
```

---

## Testing

### Test with curl

```bash
curl -X POST https://your-n8n.com/webhook/classify-inbox-item \
  -H "Content-Type: application/json" \
  -d '{
    "inboxItemId": "test-123",
    "content": "Remember to call John about the project deadline next Tuesday",
    "source": "manual",
    "type": "manual",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "callbackUrl": "https://webhook.site/your-unique-id"
  }'
```

**Expected immediate response (202):**
```json
{
  "acknowledged": true,
  "inboxItemId": "test-123",
  "message": "Classification started"
}
```

### Test with webhook.site

1. Go to https://webhook.site and copy your unique URL
2. Replace `callbackUrl` in the curl command with your webhook.site URL
3. Run the curl command
4. Check webhook.site to see the callback payload

---

## Workflow Diagram

```
┌─────────────────┐     ┌─────────────────────┐
│ Webhook Trigger │────▶│ Respond to Webhook  │
│ (POST request)  │     │ (Returns 202 ACK)   │
│ typeVersion:2.1 │     │ typeVersion:1.5     │
└─────────────────┘     └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │  AI Classification  │
                        │  (3 parallel calls) │
                        │  + Entity Linking   │
                        │  typeVersion:2      │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               Success          Error            │
                    │              │              │
                    ▼              ▼              │
         ┌─────────────────┐  ┌──────────────┐   │
         │ Call Bee        │  │ Handle Error │   │
         │ Callback        │  │              │   │
         │ typeVersion:4.3 │  └──────┬───────┘   │
         └─────────────────┘         │           │
                                     ▼           │
                              ┌──────────────┐   │
                              │ Send Error   │   │
                              │ Callback     │   │
                              └──────────────┘   │
```

---

## Troubleshooting

### Webhook not receiving requests
- Check n8n is accessible from Bee's server
- Verify `N8N_CLASSIFY_WEBHOOK_URL` in Bee's `.env`
- Check n8n workflow is **activated**

### Immediate response not working
- Ensure Webhook node has `responseMode: "responseNode"` (not `"onReceived"`)
- Verify Respond to Webhook node is connected after Webhook Trigger
- Check Respond to Webhook `typeVersion` is `1.5`

### AI response parsing errors
- Ensure `response_format: { type: 'json_object' }` is set
- Check OpenAI API key is valid and has credits
- Check n8n execution logs for detailed errors

### Callback returns 401
- If you set `N8N_WEBHOOK_SECRET` in Bee, add the header in n8n HTTP Request:
  ```
  X-Webhook-Secret: {{ $env.BEE_WEBHOOK_SECRET }}
  ```
- Or leave `N8N_WEBHOOK_SECRET` unset for no auth (dev mode)

### Supabase entity linking not working
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in n8n
- Check service role key has access to Project and Area tables
- Entity linking is optional - workflow works without it

### Timeout errors
- OpenAI API calls may take 5-15 seconds
- Default callback timeout is 30 seconds
- Check n8n execution history for timing details

### Code node errors
- Code node must return an array of objects: `return [{ json: { ... } }]`
- Use `$input.first().json` to access input data
- Check n8n execution logs for JavaScript errors

---

## Advanced: Using Claude Instead of OpenAI

Replace the OpenAI fetch call with:

```javascript
async function callClaude(systemPrompt, userContent) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': $env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const result = await response.json();
  return JSON.parse(result.content[0].text);
}
```

Then update `modelUsed` to `'claude-3-haiku'` in the return statement.

---

## References

- [n8n Respond to Webhook Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)
- [n8n Webhook Node Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n Code Node Documentation](https://docs.n8n.io/code/builtin/)
