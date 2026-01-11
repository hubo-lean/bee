# Story 1.5: External Service Connections & Verification

## Story Overview

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| **Story ID**         | 1.5                                              |
| **Epic**             | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority**         | P1 - High                                        |
| **Estimated Effort** | Medium (2-3 days)                                |
| **Dependencies**     | Story 1.1, 1.2, 1.3 (Project, Database, Auth)    |
| **Blocks**           | Epic 2+ (all external integrations)              |

## User Story

**As a** user,
**I want** to connect my email and calendar accounts to Bee,
**So that** I can capture emails and see my calendar within the app.

## Detailed Description

This story implements **service authentication** - connecting external email and calendar providers. This is **separate** from app authentication (Story 1.3).

Users can connect providers via:
1. **IMAP/SMTP credentials** (app-specific passwords) - Works with any email provider
2. **OAuth tokens** (optional) - For enhanced Microsoft/Google integration if user has OAuth app registered

Additionally, this story verifies connections to:
- **n8n** - For workflow automation
- **LibreChat** - For AI chat functionality

The story also creates a health check endpoint and Settings page for managing connections.

## Acceptance Criteria

### AC1: Email Account Model & Storage

- [ ] `EmailAccount` model added to database schema
- [ ] Support for multiple email accounts per user
- [ ] IMAP credentials stored encrypted (AES-256-GCM)
- [ ] OAuth tokens stored encrypted (if applicable)
- [ ] Encryption key managed via environment variable

### AC2: IMAP Email Account Connection

- [ ] Settings page has "Add Email Account" option
- [ ] Form for IMAP configuration: host, port, username, app password
- [ ] Connection test before saving credentials
- [ ] Success/failure feedback shown to user
- [ ] Account appears in connected accounts list
- [ ] Can remove/disconnect account

### AC3: OAuth Email Account (Optional)

- [ ] Support for Microsoft OAuth (if configured)
- [ ] Support for Google OAuth (if configured)
- [ ] OAuth flow completes and tokens stored
- [ ] Gracefully hidden if OAuth not configured

### AC4: Calendar Account Connection

- [ ] CalDAV configuration option
- [ ] Microsoft/Google calendar OAuth (if configured)
- [ ] Connection test validates calendar access
- [ ] Calendar URL stored for sync

### AC5: n8n Webhook Connection

- [ ] n8n instance accessible from development machine
- [ ] Test webhook endpoint created in n8n
- [ ] Bee can POST to n8n webhook successfully
- [ ] n8n can POST back to Bee's callback endpoint
- [ ] Webhook secret authentication works
- [ ] Connection timeout handled (5 second timeout)

### AC6: LibreChat/MCP Connection

- [ ] LibreChat instance accessible
- [ ] Can send test message and receive response
- [ ] API key authentication works
- [ ] Connection errors handled gracefully

### AC7: Health Check Endpoint

- [ ] Endpoint: `GET /api/health`
- [ ] Returns status for each service:
  - `database`: connected/disconnected
  - `n8n`: connected/disconnected
  - `librechat`: connected/disconnected
- [ ] Returns overall status: `healthy`/`degraded`/`unhealthy`
- [ ] Response includes timestamp and version
- [ ] Endpoint is public (no auth required)

### AC8: Settings Page Integration

- [ ] Settings page shows all connected accounts
- [ ] Visual indicators (green/red) for connected/disconnected
- [ ] "Test Connection" button for each service
- [ ] "Add Account" buttons for each provider type
- [ ] Last sync timestamp displayed
- [ ] Error messages shown for failed connections

## Technical Implementation Notes

### File: `lib/encryption.ts`

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes hex
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

### File: `server/services/account.service.ts`

```typescript
import { prisma } from "@packages/db";
import { encrypt, decrypt } from "@/lib/encryption";
import Imap from "imap";

interface ImapConfig {
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  isDefault?: boolean;
}

export const accountService = {
  // Test IMAP connection
  async testImapConnection(config: ImapConfig): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
      });

      imap.once("ready", () => {
        imap.end();
        resolve({ success: true });
      });

      imap.once("error", (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      imap.connect();
    });
  },

  // Add IMAP email account
  async addImapEmailAccount(userId: string, config: ImapConfig) {
    // Test connection first
    const testResult = await this.testImapConnection(config);
    if (!testResult.success) {
      throw new Error(`Connection failed: ${testResult.error}`);
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        name: config.name,
        email: config.email,
        provider: "imap",
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        username: config.username,
        password: encrypt(config.password), // Encrypted!
        isDefault: config.isDefault ?? false,
        syncStatus: "idle",
      },
    });
  },

  // Add OAuth email account (Microsoft or Google)
  async addOAuthEmailAccount(
    userId: string,
    provider: "microsoft_oauth" | "google_oauth",
    tokens: { email: string; accessToken: string; refreshToken: string; expiresAt: Date }
  ) {
    return prisma.emailAccount.create({
      data: {
        userId,
        name: `${provider === "microsoft_oauth" ? "Outlook" : "Gmail"} Account`,
        email: tokens.email,
        provider,
        oauthAccessToken: encrypt(tokens.accessToken),
        oauthRefreshToken: encrypt(tokens.refreshToken),
        oauthExpiresAt: tokens.expiresAt,
        isDefault: false,
        syncStatus: "idle",
      },
    });
  },

  // Get all email accounts for user
  async getEmailAccounts(userId: string) {
    return prisma.emailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        isDefault: true,
        syncStatus: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });
  },

  // Delete email account
  async deleteEmailAccount(userId: string, accountId: string) {
    return prisma.emailAccount.deleteMany({
      where: { id: accountId, userId },
    });
  },

  // Get decrypted credentials for use (internal only)
  async getEmailCredentials(accountId: string, userId: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) throw new Error("Account not found");

    if (account.provider === "imap") {
      return {
        type: "imap" as const,
        host: account.imapHost!,
        port: account.imapPort!,
        username: account.username!,
        password: decrypt(account.password!),
        smtpHost: account.smtpHost!,
        smtpPort: account.smtpPort!,
      };
    } else {
      return {
        type: "oauth" as const,
        provider: account.provider,
        accessToken: decrypt(account.oauthAccessToken!),
        refreshToken: decrypt(account.oauthRefreshToken!),
        expiresAt: account.oauthExpiresAt!,
      };
    }
  },
};
```

### File: `app/api/health/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@packages/db";

interface ServiceStatus {
  status: "connected" | "disconnected" | "error";
  latency?: number;
  error?: string;
  lastChecked: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  services: {
    database: ServiceStatus;
    n8n: ServiceStatus;
    librechat: ServiceStatus;
  };
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "connected",
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "disconnected",
      error: (error as Error).message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkN8n(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${process.env.N8N_WEBHOOK_URL}/health`, {
      method: "GET",
      headers: {
        "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET!,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      status: "connected",
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "disconnected",
      error: (error as Error).message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkLibreChat(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${process.env.LIBRECHAT_URL}/api/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.LIBRECHAT_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      status: "connected",
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "disconnected",
      error: (error as Error).message,
      lastChecked: new Date().toISOString(),
    };
  }
}

export async function GET() {
  const [database, n8n, librechat] = await Promise.all([
    checkDatabase(),
    checkN8n(),
    checkLibreChat(),
  ]);

  const services = { database, n8n, librechat };

  // Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  let overallStatus: "healthy" | "degraded" | "unhealthy";

  if (statuses.every((s) => s === "connected")) {
    overallStatus = "healthy";
  } else if (statuses.some((s) => s === "connected")) {
    overallStatus = "degraded";
  } else {
    overallStatus = "unhealthy";
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version || "0.1.0",
    timestamp: new Date().toISOString(),
    services,
  };

  return NextResponse.json(response, {
    status: overallStatus === "unhealthy" ? 503 : 200,
  });
}
```

### File: `app/api/accounts/email/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accountService } from "@/server/services/account.service";
import { z } from "zod";

const addImapAccountSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  isDefault: z.boolean().optional(),
});

// GET - List all email accounts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await accountService.getEmailAccounts(session.user.id);
  return NextResponse.json({ accounts });
}

// POST - Add new email account
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = addImapAccountSchema.parse(body);

    const account = await accountService.addImapEmailAccount(session.user.id, data);

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        provider: account.provider,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    return NextResponse.json(
      { error: (error as Error).message || "Failed to add account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove email account
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("id");

  if (!accountId) {
    return NextResponse.json({ error: "Account ID required" }, { status: 400 });
  }

  await accountService.deleteEmailAccount(session.user.id, accountId);
  return NextResponse.json({ success: true });
}
```

### File: `app/api/accounts/email/test/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accountService } from "@/server/services/account.service";
import { z } from "zod";

const testConnectionSchema = z.object({
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = testConnectionSchema.parse(body);

    const result = await accountService.testImapConnection({
      ...data,
      name: "",
      email: "",
      smtpHost: "",
      smtpPort: 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

### Prisma Schema Addition: `EmailAccount` Model

Add to `packages/db/prisma/schema.prisma`:

```prisma
model EmailAccount {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name             String    // Display name (e.g., "Work Email")
  email            String    // Email address
  provider         String    // imap, microsoft_oauth, google_oauth

  // IMAP credentials (encrypted)
  imapHost         String?
  imapPort         Int?
  smtpHost         String?
  smtpPort         Int?
  username         String?
  password         String?   // Encrypted with AES-256-GCM

  // OAuth tokens (encrypted)
  oauthAccessToken  String?  // Encrypted
  oauthRefreshToken String?  // Encrypted
  oauthExpiresAt    DateTime?

  isDefault        Boolean   @default(false)
  syncStatus       String    @default("idle") // idle, syncing, error
  lastSyncAt       DateTime?
  lastSyncError    String?

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([userId])
}

model CalendarAccount {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name             String
  provider         String    // caldav, microsoft_oauth, google_oauth
  calendarUrl      String?   // For CalDAV

  // OAuth tokens (encrypted)
  oauthAccessToken  String?
  oauthRefreshToken String?
  oauthExpiresAt    DateTime?

  isDefault        Boolean   @default(false)
  syncStatus       String    @default("idle")
  lastSyncAt       DateTime?

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([userId])
}

// Update User model to add relations
model User {
  // ... existing fields ...
  emailAccounts     EmailAccount[]
  calendarAccounts  CalendarAccount[]
}
```

### File: `app/(auth)/settings/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  Mail,
  Calendar,
  Zap,
  Bot,
  Database,
} from "lucide-react";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: string;
  isDefault: boolean;
  syncStatus: string;
  lastSyncAt: string | null;
}

interface ServiceStatus {
  status: "connected" | "disconnected" | "checking";
  latency?: number;
  error?: string;
}

export default function SettingsPage() {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({});
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state for adding email account
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 587,
    username: "",
    password: "",
  });
  const [formError, setFormError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch email accounts
  useEffect(() => {
    fetchEmailAccounts();
    checkServiceHealth();
  }, []);

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch("/api/accounts/email");
      const data = await response.json();
      setEmailAccounts(data.accounts || []);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkServiceHealth = async () => {
    try {
      const response = await fetch("/api/health");
      const health = await response.json();

      const statuses: Record<string, ServiceStatus> = {};
      for (const [key, value] of Object.entries(health.services)) {
        const service = value as any;
        statuses[key] = {
          status: service.status === "connected" ? "connected" : "disconnected",
          latency: service.latency,
          error: service.error,
        };
      }
      setServiceStatuses(statuses);
    } catch (error) {
      console.error("Health check failed:", error);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setFormError("");

    try {
      const response = await fetch("/api/accounts/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: formData.imapHost,
          imapPort: formData.imapPort,
          username: formData.username,
          password: formData.password,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setFormError(result.error || "Connection test failed");
      } else {
        setFormError("");
        alert("Connection successful!");
      }
    } catch (error) {
      setFormError("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const saveAccount = async () => {
    setIsSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/accounts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        setFormError(result.error || "Failed to save account");
        return;
      }

      // Refresh accounts list
      await fetchEmailAccounts();
      setIsAddingAccount(false);
      resetForm();
    } catch (error) {
      setFormError("Failed to save account");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;

    try {
      await fetch(`/api/accounts/email?id=${accountId}`, { method: "DELETE" });
      await fetchEmailAccounts();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      imapHost: "",
      imapPort: 993,
      smtpHost: "",
      smtpPort: 587,
      username: "",
      password: "",
    });
    setFormError("");
  };

  const getStatusBadge = (status: string) => {
    if (status === "connected") {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="mr-1 h-3 w-3" />
          Connected
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800">
        <XCircle className="mr-1 h-3 w-3" />
        Disconnected
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account connections and preferences</p>
      </div>

      {/* Email Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Accounts
            </CardTitle>
            <CardDescription>Connect your email accounts to capture messages</CardDescription>
          </div>
          <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddingAccount(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Email Account (IMAP)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {formError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {formError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    placeholder="e.g., Work Email"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IMAP Host</Label>
                    <Input
                      placeholder="imap.example.com"
                      value={formData.imapHost}
                      onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>IMAP Port</Label>
                    <Input
                      type="number"
                      value={formData.imapPort}
                      onChange={(e) =>
                        setFormData({ ...formData, imapPort: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      placeholder="smtp.example.com"
                      value={formData.smtpHost}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Port</Label>
                    <Input
                      type="number"
                      value={formData.smtpPort}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpPort: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="Usually your email address"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>App Password</Label>
                  <Input
                    type="password"
                    placeholder="App-specific password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Use an app-specific password, not your regular password
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={testConnection} disabled={isTesting}>
                    {isTesting ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button onClick={saveAccount} disabled={isSaving} className="flex-1">
                    {isSaving ? "Saving..." : "Save Account"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : emailAccounts.length === 0 ? (
            <p className="text-gray-500">No email accounts connected</p>
          ) : (
            <div className="space-y-3">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-gray-500">{account.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(account.syncStatus === "error" ? "disconnected" : "connected")}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Services */}
      <Card>
        <CardHeader>
          <CardTitle>System Services</CardTitle>
          <CardDescription>Backend service connections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-gray-500">Supabase PostgreSQL</p>
              </div>
            </div>
            {getStatusBadge(serviceStatuses.database?.status || "disconnected")}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">n8n Workflows</p>
                <p className="text-sm text-gray-500">Automation engine</p>
              </div>
            </div>
            {getStatusBadge(serviceStatuses.n8n?.status || "disconnected")}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">LibreChat AI</p>
                <p className="text-sm text-gray-500">AI chat service</p>
              </div>
            </div>
            {getStatusBadge(serviceStatuses.librechat?.status || "disconnected")}
          </div>

          <Button variant="outline" onClick={checkServiceHealth} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Files to Create/Modify

| File                                   | Action | Purpose                      |
| -------------------------------------- | ------ | ---------------------------- |
| `lib/encryption.ts`                    | Create | Credential encryption        |
| `server/services/account.service.ts`   | Create | Email account management     |
| `app/api/health/route.ts`              | Create | Health check endpoint        |
| `app/api/accounts/email/route.ts`      | Create | Email account CRUD           |
| `app/api/accounts/email/test/route.ts` | Create | Test IMAP connection         |
| `app/(auth)/settings/page.tsx`         | Update | Settings with accounts       |
| `packages/db/prisma/schema.prisma`     | Modify | Add EmailAccount model       |
| `.env.local`                           | Update | Add ENCRYPTION_KEY           |
| `.env.example`                         | Update | Document env vars            |

## Dependencies to Install

```bash
pnpm add imap
pnpm add -D @types/imap
```

## Environment Variables Required

```bash
# Encryption Key for storing credentials
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY="64-character-hex-string"

# n8n Integration
N8N_WEBHOOK_URL="https://n8n.yourdomain.com/webhook"
N8N_WEBHOOK_SECRET="shared-secret-for-auth"

# LibreChat / MCP
LIBRECHAT_URL="https://chat.yourdomain.com"
LIBRECHAT_API_KEY="your-api-key"

# Optional: Microsoft OAuth for enhanced Outlook
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

## Testing Requirements

### Manual Testing

1. **Health Endpoint**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Verify response includes all services with status

2. **Add Email Account**:
   - Go to Settings
   - Click "Add Account"
   - Enter IMAP credentials
   - Click "Test Connection" - should succeed
   - Click "Save Account"
   - Account should appear in list

3. **Delete Account**:
   - Click trash icon on account
   - Confirm deletion
   - Account should be removed

### Edge Cases

- Test with invalid IMAP credentials - should show error
- Test with n8n offline - health check should show disconnected
- Test encryption/decryption with special characters

## Definition of Done

- [ ] All acceptance criteria met
- [ ] EmailAccount model in database
- [ ] IMAP accounts can be added and tested
- [ ] Credentials encrypted in database
- [ ] Health endpoint returns all service statuses
- [ ] Settings page shows connected accounts
- [ ] Can remove email accounts
- [ ] Environment variables documented

## Notes & Decisions

- **IMAP as primary**: Works with any email provider, no OAuth app registration needed
- **Encrypted storage**: AES-256-GCM for credential security
- **Separate from app auth**: Email provider is not same as app login
- **OAuth optional**: Users can add OAuth later if they want enhanced features
- **App-specific passwords**: Required for most providers, more secure

## Troubleshooting Guide

### IMAP Connection Errors

| Error                | Cause                    | Solution                              |
| -------------------- | ------------------------ | ------------------------------------- |
| `AUTHENTICATIONFAILED` | Wrong credentials      | Verify username/password              |
| `Connection refused` | Wrong host/port          | Check IMAP host and port settings     |
| `Certificate error`  | TLS issues               | Try different port or check settings  |
| `Timeout`            | Firewall blocking        | Check network/firewall settings       |

### Common IMAP Settings

| Provider    | IMAP Host           | Port | SMTP Host           | Port |
| ----------- | ------------------- | ---- | ------------------- | ---- |
| Gmail       | imap.gmail.com      | 993  | smtp.gmail.com      | 587  |
| Outlook     | outlook.office365.com | 993 | smtp.office365.com  | 587  |
| Yahoo       | imap.mail.yahoo.com | 993  | smtp.mail.yahoo.com | 587  |
| iCloud      | imap.mail.me.com    | 993  | smtp.mail.me.com    | 587  |

## Related Documentation

- [Architecture Document](../../architecture.md) - Service authentication flow
- [n8n Documentation](https://docs.n8n.io/) - Workflow setup
