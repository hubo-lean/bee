# Story 2.4: Email Forwarding to Inbox

## Story Overview

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Story ID**         | 2.4                                             |
| **Epic**             | [Epic 2: Unified Inbox & Capture](epic-2.md)    |
| **Priority**         | P2 - Medium                                     |
| **Estimated Effort** | Medium (2-3 days)                               |
| **Dependencies**     | Story 2.1 (Manual Text Capture), Epic 1 (n8n)   |
| **Blocks**           | None                                            |

## User Story

**As a** user,
**I want** to forward emails to my Bee inbox,
**So that** I can capture important messages without leaving my email client.

## Detailed Description

This story enables email capture via forwarding. Users forward emails to a dedicated email address or webhook endpoint, which triggers an n8n workflow to:

1. Receive the forwarded email
2. Parse sender, subject, body, and attachments
3. Create an InboxItem via API webhook
4. Optionally store attachments in Supabase Storage

This leverages the existing n8n infrastructure on Hugo's VPS for reliable email processing.

## Acceptance Criteria

### AC1: Webhook Endpoint

- [ ] REST API endpoint at `/api/webhooks/email` accepts POST requests
- [ ] Validates request signature/secret from n8n
- [ ] Returns 200 OK on success, appropriate error codes on failure
- [ ] Rate limiting: max 100 requests per minute per user

### AC2: Email Parsing

- [ ] n8n workflow parses forwarded email:
  - Original sender (From header)
  - Subject line
  - Body text (plain text preferred, HTML fallback)
  - Attachment metadata (name, size, type)
- [ ] Strips forwarding headers/prefixes (Fwd:, FW:, etc.)
- [ ] Extracts original email date if available

### AC3: InboxItem Creation

- [ ] InboxItem created with:
  - `type: "email"`
  - `content: [email body text]`
  - `source: "email-forward"`
  - `status: "pending"`
  - `metadata: { from, subject, originalDate, hasAttachments }`
- [ ] Email metadata stored as JSON in content or separate field

### AC4: Attachment Handling

- [ ] Attachments listed in email metadata
- [ ] Small attachments (< 5MB) stored in Supabase Storage
- [ ] Large attachments logged but not stored (with note in metadata)
- [ ] Attachment URLs included in InboxItem metadata

### AC5: User Association

- [ ] Forward-to email address includes user identifier
- [ ] Format: `inbox+{userToken}@bee.domain.com`
- [ ] n8n extracts token and passes to webhook
- [ ] Webhook validates token and associates with user

### AC6: n8n Workflow

- [ ] Workflow triggers on email received
- [ ] Parses email content using n8n email nodes
- [ ] Calls Bee webhook with parsed data
- [ ] Handles errors gracefully with retries

### AC7: Processing Speed

- [ ] Email appears in inbox within 30 seconds of forwarding
- [ ] User sees new item on next inbox refresh
- [ ] No email loss (queue/retry on failure)

## Technical Implementation Notes

### File: `app/api/webhooks/email/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@packages/db';
import { z } from 'zod';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET!;

// Schema for incoming email webhook
const emailWebhookSchema = z.object({
  userToken: z.string(),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  originalDate: z.string().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        url: z.string().url().optional(),
      })
    )
    .optional()
    .default([]),
});

type EmailWebhookPayload = z.infer<typeof emailWebhookSchema>;

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Clean up forwarding prefixes
function cleanSubject(subject: string): string {
  return subject.replace(/^(Fwd?:|FW:|Re:|RE:)\s*/gi, '').trim();
}

// Extract plain text from HTML if needed
function extractTextFromHtml(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-webhook-signature');
    const body = await request.text();

    if (!signature || !verifySignature(body, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse and validate payload
    const payload = emailWebhookSchema.parse(JSON.parse(body));

    // Find user by token
    const userToken = await prisma.userToken.findUnique({
      where: { token: payload.userToken },
      include: { user: true },
    });

    if (!userToken || !userToken.user) {
      return NextResponse.json(
        { error: 'Invalid user token' },
        { status: 404 }
      );
    }

    // Clean and prepare content
    const cleanedSubject = cleanSubject(payload.subject);
    const bodyText = payload.body.includes('<')
      ? extractTextFromHtml(payload.body)
      : payload.body;

    // Format email content
    const content = `**From:** ${payload.from}\n**Subject:** ${cleanedSubject}\n\n${bodyText}`;

    // Create inbox item
    const inboxItem = await prisma.inboxItem.create({
      data: {
        userId: userToken.user.id,
        type: 'email',
        content,
        source: 'email-forward',
        status: 'pending',
        // Store metadata as JSON string (or use a separate JSON field)
        // For now, embedding in content is simpler
      },
    });

    // Log for debugging
    console.log(`Email captured for user ${userToken.user.email}: ${cleanedSubject}`);

    return NextResponse.json({
      success: true,
      inboxItemId: inboxItem.id,
    });
  } catch (error) {
    console.error('Email webhook error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### File: `prisma/schema.prisma` (Add UserToken model)

```prisma
// Add to existing schema.prisma

model UserToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  type      String   // "email_forward", "api_key", etc.
  createdAt DateTime @default(now())
  expiresAt DateTime?

  @@index([token])
  @@index([userId])
}

// Add to User model:
model User {
  // ... existing fields
  tokens    UserToken[]
}
```

### n8n Workflow Configuration

```json
{
  "name": "Bee Email Forward",
  "nodes": [
    {
      "name": "Email Trigger",
      "type": "n8n-nodes-base.emailTrigger",
      "parameters": {
        "mailbox": "inbox",
        "format": "resolved"
      }
    },
    {
      "name": "Extract User Token",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Extract user token from To address\n// Format: inbox+{token}@bee.domain.com\nconst toAddress = $input.item.json.to;\nconst match = toAddress.match(/inbox\\+([a-zA-Z0-9]+)@/);\n\nif (!match) {\n  throw new Error('Invalid forwarding address');\n}\n\nreturn {\n  userToken: match[1],\n  from: $input.item.json.from,\n  subject: $input.item.json.subject,\n  body: $input.item.json.text || $input.item.json.html,\n  originalDate: $input.item.json.date,\n  attachments: ($input.item.json.attachments || []).map(a => ({\n    name: a.filename,\n    size: a.size,\n    type: a.contentType\n  }))\n};"
      }
    },
    {
      "name": "Call Bee Webhook",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://bee.domain.com/api/webhooks/email",
        "headers": {
          "Content-Type": "application/json",
          "x-webhook-signature": "={{$env.WEBHOOK_SIGNATURE}}"
        },
        "body": "={{JSON.stringify($node[\"Extract User Token\"].json)}}"
      }
    },
    {
      "name": "Error Handler",
      "type": "n8n-nodes-base.errorTrigger"
    }
  ],
  "connections": {
    "Email Trigger": {
      "main": [["Extract User Token"]]
    },
    "Extract User Token": {
      "main": [["Call Bee Webhook"]]
    }
  }
}
```

### File: `server/routers/user.ts` (Add token generation)

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@packages/db';
import { nanoid } from 'nanoid';

export const userRouter = router({
  // Generate email forwarding token
  generateForwardToken: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user already has an email forward token
    const existing = await prisma.userToken.findFirst({
      where: {
        userId: ctx.session.user.id,
        type: 'email_forward',
      },
    });

    if (existing) {
      return {
        token: existing.token,
        address: `inbox+${existing.token}@${process.env.EMAIL_DOMAIN}`,
      };
    }

    // Generate new token
    const token = nanoid(12); // e.g., "V1StGXR8_Z5j"

    await prisma.userToken.create({
      data: {
        userId: ctx.session.user.id,
        token,
        type: 'email_forward',
      },
    });

    return {
      token,
      address: `inbox+${token}@${process.env.EMAIL_DOMAIN}`,
    };
  }),

  // Get current forwarding address
  getForwardAddress: protectedProcedure.query(async ({ ctx }) => {
    const token = await prisma.userToken.findFirst({
      where: {
        userId: ctx.session.user.id,
        type: 'email_forward',
      },
    });

    if (!token) {
      return null;
    }

    return {
      address: `inbox+${token.token}@${process.env.EMAIL_DOMAIN}`,
    };
  }),
});
```

### File: `components/settings/email-forward-setup.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Copy, Check, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';

export function EmailForwardSetup() {
  const [copied, setCopied] = useState(false);

  const { data: forwardAddress, isLoading } = api.user.getForwardAddress.useQuery();

  const generateToken = api.user.generateForwardToken.useMutation({
    onSuccess: () => {
      toast.success('Forwarding address created!');
    },
    onError: (error) => {
      toast.error('Failed to create forwarding address', {
        description: error.message,
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Forwarding
        </CardTitle>
        <CardDescription>
          Forward emails to your Bee inbox by sending them to your unique address
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forwardAddress ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-gray-50 p-3">
              <code className="flex-1 text-sm">{forwardAddress.address}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(forwardAddress.address)}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Forward any email to this address and it will appear in your Bee inbox within 30 seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Get a unique email address to forward emails to your Bee inbox.
            </p>
            <Button
              onClick={() => generateToken.mutate()}
              disabled={generateToken.isPending}
            >
              {generateToken.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Generate Forwarding Address
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## Files to Create/Modify

| File                                           | Action | Purpose                          |
| ---------------------------------------------- | ------ | -------------------------------- |
| `app/api/webhooks/email/route.ts`              | Create | Webhook endpoint for n8n         |
| `prisma/schema.prisma`                         | Modify | Add UserToken model              |
| `server/routers/user.ts`                       | Modify | Add token generation endpoints   |
| `components/settings/email-forward-setup.tsx`  | Create | Settings UI for email forwarding |

## n8n Configuration Required

1. **Email Trigger Node:**
   - Configure IMAP connection to email server
   - Monitor inbox for new emails
   - Filter by To address pattern: `inbox+*@bee.domain.com`

2. **Environment Variables in n8n:**
   - `WEBHOOK_SIGNATURE`: Shared secret for webhook auth

3. **Email Server Setup:**
   - Configure catch-all or plus-addressing for `inbox+*@bee.domain.com`
   - Route to n8n email trigger

## Environment Variables Required

```bash
# n8n webhook authentication
N8N_WEBHOOK_SECRET="your-secure-webhook-secret"

# Email domain for forwarding
EMAIL_DOMAIN="bee.yourdomain.com"
```

## Testing Requirements

### Manual Testing

1. **Generate Forward Address:**
   - Go to Settings > Email Forwarding
   - Click "Generate Forwarding Address"
   - Copy address shows correctly

2. **Forward Email:**
   - Forward an email to generated address
   - Wait 30 seconds
   - Check inbox for new item
   - Verify from, subject, body captured

3. **Email Content:**
   - Forward plain text email - body captured
   - Forward HTML email - text extracted
   - Verify formatting preserved reasonably

4. **Error Cases:**
   - Send to invalid token address - no crash
   - Send empty email - handled gracefully

### Webhook Tests

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('Email webhook', () => {
  it('creates inbox item from valid email payload', async () => {
    const payload = {
      userToken: 'validtoken123',
      from: 'sender@example.com',
      subject: 'Fwd: Test Email',
      body: 'This is the email body',
    };

    const signature = generateSignature(JSON.stringify(payload));

    const request = new NextRequest('http://localhost/api/webhooks/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.inboxItemId).toBeDefined();
  });

  it('rejects invalid signature', async () => {
    const request = new NextRequest('http://localhost/api/webhooks/email', {
      method: 'POST',
      headers: {
        'x-webhook-signature': 'invalid',
      },
      body: '{}',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Webhook endpoint secured with signature verification
- [ ] n8n workflow created and tested
- [ ] User can generate forwarding address in settings
- [ ] Forwarded emails create inbox items
- [ ] Subject cleaned of Fwd:/FW: prefixes
- [ ] Email body text extracted correctly
- [ ] Processing completes within 30 seconds
- [ ] Integration tests pass

## Notes & Decisions

- **Plus-addressing:** Standard email feature, works with most providers
- **n8n over custom IMAP polling:** Leverages existing infrastructure, visual debugging
- **Signature verification:** Prevents unauthorized webhook calls
- **No attachment storage (MVP):** Just metadata - can add storage later
- **Single forwarding address per user:** Simpler to manage, can add multiple later

## Future Enhancements

- Direct IMAP sync (bypass forwarding)
- Attachment storage and preview
- Multiple forwarding addresses
- Email rules (auto-tag based on sender/subject)
- Reply to emails from Bee

## Related Documentation

- [Architecture Document](../../architecture.md) - n8n integration section
- [n8n Documentation](https://docs.n8n.io/)
- [PRD](../../prd.md) - FR4 (Email forwarding requirements)
