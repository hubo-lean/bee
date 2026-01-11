# n8n Email Forwarding Workflow Setup

This document describes how to configure n8n to process forwarded emails and send them to Bee's webhook endpoint.

## Prerequisites

- n8n instance running on your VPS
- Email server configured to receive emails at `inbox+*@yourdomain.com`
- Bee application deployed with webhook endpoint

## Environment Variables

Set these environment variables in your n8n instance:

```bash
BEE_WEBHOOK_URL=https://your-bee-domain.com/api/webhooks/email
BEE_WEBHOOK_SECRET=your-secure-webhook-secret-here
```

## Workflow Overview

```
[Email Received] → [Extract User Token] → [Parse Email] → [Generate Signature] → [Call Webhook]
```

## Workflow Configuration

### Node 1: Email Trigger

Configure the Email Trigger node to monitor your inbox:

- **Node Type:** Email Trigger (IMAP)
- **Mailbox:** INBOX
- **Format:** Resolved
- **Download Attachments:** Optional (set to true if you want attachment metadata)

### Node 2: Extract User Token (Code Node)

```javascript
// Extract user token from To address
// Format: inbox+{userToken}@domain.com

const toAddress = $input.item.json.to;

// Handle array or string format
const toEmail = Array.isArray(toAddress) ? toAddress[0].address : toAddress;

// Extract token using regex
const match = toEmail.match(/inbox\+([a-zA-Z0-9_-]+)@/);

if (!match) {
  throw new Error('Invalid forwarding address format');
}

return {
  userToken: match[1],
  from: $input.item.json.from?.address || $input.item.json.from,
  subject: $input.item.json.subject || '(No Subject)',
  body: $input.item.json.text || $input.item.json.html || '',
  originalDate: $input.item.json.date,
  attachments: ($input.item.json.attachments || []).map(att => ({
    name: att.filename,
    size: att.size,
    type: att.contentType
  }))
};
```

### Node 3: Generate Signature (Code Node)

```javascript
// Generate HMAC-SHA256 signature for webhook authentication
const crypto = require('crypto');

const payload = JSON.stringify($input.item.json);
const secret = $env.BEE_WEBHOOK_SECRET;

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

return {
  ...$input.item.json,
  _signature: signature,
  _payload: payload
};
```

### Node 4: HTTP Request (Call Webhook)

- **Method:** POST
- **URL:** `{{ $env.BEE_WEBHOOK_URL }}`
- **Authentication:** None (signature in header)
- **Headers:**
  - `Content-Type`: `application/json`
  - `x-webhook-signature`: `{{ $json._signature }}`
- **Body Content Type:** JSON
- **Body Parameters:**
  - `userToken`: `{{ $json.userToken }}`
  - `from`: `{{ $json.from }}`
  - `subject`: `{{ $json.subject }}`
  - `body`: `{{ $json.body }}`
  - `originalDate`: `{{ $json.originalDate }}`
  - `attachments`: `{{ $json.attachments }}`

## Complete Workflow JSON

Import this JSON directly into n8n:

```json
{
  "name": "Bee Email Forward",
  "nodes": [
    {
      "parameters": {
        "mailbox": "INBOX",
        "format": "resolved",
        "options": {
          "downloadAttachments": false
        }
      },
      "id": "email-trigger",
      "name": "Email Trigger",
      "type": "n8n-nodes-base.emailTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "jsCode": "const toAddress = $input.item.json.to;\nconst toEmail = Array.isArray(toAddress) ? toAddress[0].address : toAddress;\nconst match = toEmail.match(/inbox\\+([a-zA-Z0-9_-]+)@/);\nif (!match) throw new Error('Invalid forwarding address format');\nreturn {\n  userToken: match[1],\n  from: $input.item.json.from?.address || $input.item.json.from,\n  subject: $input.item.json.subject || '(No Subject)',\n  body: $input.item.json.text || $input.item.json.html || '',\n  originalDate: $input.item.json.date,\n  attachments: ($input.item.json.attachments || []).map(att => ({ name: att.filename, size: att.size, type: att.contentType }))\n};"
      },
      "id": "extract-token",
      "name": "Extract User Token",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "const crypto = require('crypto');\nconst payload = JSON.stringify($input.item.json);\nconst secret = $env.BEE_WEBHOOK_SECRET;\nconst signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');\nreturn { ...$input.item.json, _signature: signature, _payload: payload };"
      },
      "id": "generate-signature",
      "name": "Generate Signature",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.BEE_WEBHOOK_URL }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "x-webhook-signature",
              "value": "={{ $json._signature }}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "userToken", "value": "={{ $json.userToken }}" },
            { "name": "from", "value": "={{ $json.from }}" },
            { "name": "subject", "value": "={{ $json.subject }}" },
            { "name": "body", "value": "={{ $json.body }}" },
            { "name": "originalDate", "value": "={{ $json.originalDate }}" },
            { "name": "attachments", "value": "={{ $json.attachments }}" }
          ]
        }
      },
      "id": "http-request",
      "name": "Call Bee Webhook",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Email Trigger": {
      "main": [[{ "node": "Extract User Token", "type": "main", "index": 0 }]]
    },
    "Extract User Token": {
      "main": [[{ "node": "Generate Signature", "type": "main", "index": 0 }]]
    },
    "Generate Signature": {
      "main": [[{ "node": "Call Bee Webhook", "type": "main", "index": 0 }]]
    }
  }
}
```

## Email Server Configuration

### Option 1: Catch-all with Plus Addressing

Configure your email server to accept all emails to `inbox+*@yourdomain.com` and route them to a single mailbox that n8n monitors.

### Option 2: Postfix Configuration

Add to `/etc/postfix/main.cf`:

```
recipient_delimiter = +
```

This enables plus addressing so `inbox+abc123@domain.com` is delivered to the `inbox` mailbox.

## Testing

1. Generate a forwarding address in Bee Settings
2. Send a test email to your forwarding address
3. Check n8n execution logs
4. Verify the item appears in your Bee inbox

## Troubleshooting

### Common Issues

1. **401 Invalid signature**
   - Verify `BEE_WEBHOOK_SECRET` matches in both n8n and Bee
   - Ensure payload is JSON stringified before signing

2. **404 Invalid user token**
   - Check the token extraction regex
   - Verify the user has generated a forwarding address

3. **400 Invalid payload**
   - Ensure all required fields are present
   - Check that `from` and `subject` are not empty

### Debug Mode

Add a Set node before the HTTP Request to log the payload:

```javascript
console.log('Webhook payload:', JSON.stringify($input.item.json, null, 2));
return $input.item.json;
```
