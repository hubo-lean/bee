# Story 1.5: External Service Connection Verification

## Story Overview

| Field | Value |
|-------|-------|
| **Story ID** | 1.5 |
| **Epic** | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority** | P1 - High |
| **Estimated Effort** | Medium (2-3 days) |
| **Dependencies** | Story 1.1, 1.2, 1.3 (Project, Database, Auth) |
| **Blocks** | Epic 2+ (all external integrations) |

## User Story

**As a** developer,
**I want** to verify connections to external services,
**So that** I know integrations will work before building features that depend on them.

## Detailed Description

This story validates that Bee can successfully communicate with all required external services:

1. **Microsoft Graph API** - For email, calendar, and OneDrive access
2. **n8n** - For workflow automation and integrations
3. **LibreChat** - For AI chat functionality (via MCP or API)
4. **LLM APIs** - For AI classification (tested via n8n)

The goal is to create test connections and a health check endpoint that confirms all services are operational before building features that depend on them.

## Acceptance Criteria

### AC1: Microsoft Graph API Connection
- [ ] Can fetch authenticated user's profile via Graph API
- [ ] Can fetch user's calendar events (read test)
- [ ] Can fetch user's OneDrive root folder (read test)
- [ ] Access token used from NextAuth session
- [ ] Token refresh works when token is expired
- [ ] Errors handled gracefully with clear messages

### AC2: n8n Webhook Connection
- [ ] n8n instance accessible from development machine
- [ ] Test webhook endpoint created in n8n
- [ ] Bee can POST to n8n webhook successfully
- [ ] n8n can POST back to Bee's callback endpoint
- [ ] Webhook secret authentication works
- [ ] Connection timeout handled (5 second timeout)

### AC3: LibreChat/MCP Connection
- [ ] LibreChat instance accessible
- [ ] Can send test message and receive response
- [ ] MCP protocol connection verified (if applicable)
- [ ] API key authentication works
- [ ] Connection errors handled gracefully

### AC4: Health Check Endpoint
- [ ] Endpoint: `GET /api/health`
- [ ] Returns status for each service:
  - `database`: connected/disconnected
  - `microsoft`: connected/disconnected/token_error
  - `n8n`: connected/disconnected
  - `librechat`: connected/disconnected
- [ ] Returns overall status: `healthy`/`degraded`/`unhealthy`
- [ ] Response includes timestamp and version
- [ ] Endpoint is public (no auth required)

### AC5: Environment Variable Documentation
- [ ] All service URLs documented in `.env.example`
- [ ] All API keys/secrets documented (with placeholders)
- [ ] Connection requirements documented in README
- [ ] Troubleshooting guide for common connection issues

### AC6: Settings Page Integration
- [ ] Settings page shows connection status for each service
- [ ] Visual indicators (green/red) for connected/disconnected
- [ ] "Test Connection" button for each service
- [ ] Last checked timestamp displayed
- [ ] Error messages shown for failed connections

## Technical Implementation Notes

### File: `app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@packages/db';

interface ServiceStatus {
  status: 'connected' | 'disconnected' | 'error';
  latency?: number;
  error?: string;
  lastChecked: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
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
      status: 'connected',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: (error as Error).message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkN8n(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${process.env.N8N_WEBHOOK_URL}/health`, {
      method: 'GET',
      headers: {
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET!,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      status: 'connected',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: (error as Error).message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkLibreChat(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${process.env.LIBRECHAT_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.LIBRECHAT_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      status: 'connected',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'disconnected',
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
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (statuses.every((s) => s === 'connected')) {
    overallStatus = 'healthy';
  } else if (statuses.some((s) => s === 'connected')) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    services,
  };

  return NextResponse.json(response, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
  });
}
```

### File: `lib/services/microsoft-graph.ts`
```typescript
import { auth } from '@/lib/auth';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export class MicrosoftGraphService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getProfile() {
    return this.fetch<{
      displayName: string;
      mail: string;
      userPrincipalName: string;
    }>('/me');
  }

  async getCalendarEvents(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    return this.fetch<{
      value: Array<{
        id: string;
        subject: string;
        start: { dateTime: string };
        end: { dateTime: string };
      }>;
    }>(`/me/calendarview?startDateTime=${start}&endDateTime=${end}`);
  }

  async getOneDriveRoot() {
    return this.fetch<{
      id: string;
      name: string;
      folder: { childCount: number };
    }>('/me/drive/root');
  }

  async testConnection(): Promise<{
    success: boolean;
    profile?: { name: string; email: string };
    error?: string;
  }> {
    try {
      const profile = await this.getProfile();
      return {
        success: true,
        profile: {
          name: profile.displayName,
          email: profile.mail || profile.userPrincipalName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

export async function getMicrosoftGraphService() {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error('No access token available');
  }

  return new MicrosoftGraphService(session.accessToken);
}
```

### File: `lib/services/n8n.ts`
```typescript
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL!;
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET!;

export class N8nService {
  private async fetch<T>(
    path: string,
    options: { method?: string; body?: object } = {}
  ): Promise<T> {
    const { method = 'POST', body } = options;

    const response = await fetch(`${N8N_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': N8N_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`n8n error: HTTP ${response.status}`);
    }

    return response.json();
  }

  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await this.fetch<{ status: string }>('/test', {
        method: 'POST',
        body: { test: true, timestamp: new Date().toISOString() },
      });

      return {
        success: true,
        message: result.status || 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async triggerClassification(itemId: string, content: string) {
    return this.fetch('/classify-inbox-item', {
      body: { itemId, content },
    });
  }

  async triggerCalendarFetch(startDate: string, endDate: string) {
    return this.fetch('/fetch-calendar', {
      body: { startDate, endDate },
    });
  }
}

export const n8nService = new N8nService();
```

### File: `lib/services/librechat.ts`
```typescript
const LIBRECHAT_URL = process.env.LIBRECHAT_URL!;
const LIBRECHAT_API_KEY = process.env.LIBRECHAT_API_KEY!;

export class LibreChatService {
  private async fetch<T>(
    path: string,
    options: { method?: string; body?: object } = {}
  ): Promise<T> {
    const { method = 'GET', body } = options;

    const response = await fetch(`${LIBRECHAT_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LIBRECHAT_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`LibreChat error: HTTP ${response.status}`);
    }

    return response.json();
  }

  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Adjust endpoint based on LibreChat's actual API
      const result = await this.fetch<{ status: string }>('/api/health');

      return {
        success: true,
        message: result.status || 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendMessage(message: string, conversationId?: string) {
    return this.fetch('/api/ask', {
      method: 'POST',
      body: {
        message,
        conversationId,
        model: 'claude-3-sonnet', // or configured default
      },
    });
  }
}

export const libreChatService = new LibreChatService();
```

### File: `app/api/test-connection/microsoft/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getMicrosoftGraphService } from '@/lib/services/microsoft-graph';

export async function GET() {
  try {
    const graphService = await getMicrosoftGraphService();
    const result = await graphService.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

### File: `app/api/test-connection/n8n/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { n8nService } from '@/lib/services/n8n';

export async function GET() {
  const result = await n8nService.testConnection();
  return NextResponse.json(result);
}
```

### File: `app/api/test-connection/librechat/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { libreChatService } from '@/lib/services/librechat';

export async function GET() {
  const result = await libreChatService.testConnection();
  return NextResponse.json(result);
}
```

### File: `app/(auth)/settings/page.tsx`
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Cloud,
  Bot,
  Zap,
} from 'lucide-react';

interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'checking' | 'unknown';
  latency?: number;
  error?: string;
  lastChecked?: string;
}

interface ServiceConfig {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
}

const services: ServiceConfig[] = [
  { id: 'database', name: 'Database (Supabase)', icon: Database, endpoint: '' },
  { id: 'microsoft', name: 'Microsoft Graph', icon: Cloud, endpoint: '/api/test-connection/microsoft' },
  { id: 'n8n', name: 'n8n Workflows', icon: Zap, endpoint: '/api/test-connection/n8n' },
  { id: 'librechat', name: 'LibreChat AI', icon: Bot, endpoint: '/api/test-connection/librechat' },
];

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [isChecking, setIsChecking] = useState(false);

  const checkAllConnections = async () => {
    setIsChecking(true);

    // Check health endpoint for overall status
    try {
      const healthResponse = await fetch('/api/health');
      const health = await healthResponse.json();

      const newStatuses: Record<string, ConnectionStatus> = {};

      for (const [key, value] of Object.entries(health.services)) {
        const service = value as any;
        newStatuses[key] = {
          status: service.status === 'connected' ? 'connected' : 'disconnected',
          latency: service.latency,
          error: service.error,
          lastChecked: service.lastChecked,
        };
      }

      setStatuses(newStatuses);
    } catch (error) {
      console.error('Health check failed:', error);
    }

    setIsChecking(false);
  };

  const checkSingleConnection = async (serviceId: string, endpoint: string) => {
    if (!endpoint) return;

    setStatuses((prev) => ({
      ...prev,
      [serviceId]: { status: 'checking' },
    }));

    try {
      const response = await fetch(endpoint);
      const result = await response.json();

      setStatuses((prev) => ({
        ...prev,
        [serviceId]: {
          status: result.success ? 'connected' : 'disconnected',
          error: result.error,
          lastChecked: new Date().toISOString(),
        },
      }));
    } catch (error) {
      setStatuses((prev) => ({
        ...prev,
        [serviceId]: {
          status: 'disconnected',
          error: (error as Error).message,
          lastChecked: new Date().toISOString(),
        },
      }));
    }
  };

  useEffect(() => {
    checkAllConnections();
  }, []);

  const getStatusBadge = (status: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="mr-1 h-3 w-3" />
            Disconnected
          </Badge>
        );
      case 'checking':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Checking...
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your connections and preferences</p>
        </div>
        <Button onClick={checkAllConnections} disabled={isChecking}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          Check All
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.map((service) => {
            const status = statuses[service.id] || { status: 'unknown' };
            const Icon = service.icon;

            return (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <Icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    {status.error && (
                      <p className="text-sm text-red-600">{status.error}</p>
                    )}
                    {status.latency && (
                      <p className="text-sm text-gray-500">
                        Latency: {status.latency}ms
                      </p>
                    )}
                    {status.lastChecked && (
                      <p className="text-xs text-gray-400">
                        Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(status.status)}
                  {service.endpoint && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkSingleConnection(service.id, service.endpoint)}
                      disabled={status.status === 'checking'}
                    >
                      Test
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Version</span>
              <span className="font-mono">{process.env.npm_package_version || '0.1.0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Environment</span>
              <span className="font-mono">{process.env.NODE_ENV}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### n8n Test Workflow (to be created in n8n)

Create a workflow in n8n with:
1. **Webhook Trigger**: Path `/test`, Method: POST
2. **Validate Secret**: Check `X-Webhook-Secret` header
3. **Respond**: Return `{ "status": "ok", "timestamp": "..." }`

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "test",
        "responseMode": "responseNode"
      }
    },
    {
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"status\": \"ok\", \"timestamp\": $now.toISO() } }}"
      }
    }
  ]
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/api/health/route.ts` | Create | Health check endpoint |
| `app/api/test-connection/microsoft/route.ts` | Create | Microsoft test endpoint |
| `app/api/test-connection/n8n/route.ts` | Create | n8n test endpoint |
| `app/api/test-connection/librechat/route.ts` | Create | LibreChat test endpoint |
| `lib/services/microsoft-graph.ts` | Create | Microsoft Graph service |
| `lib/services/n8n.ts` | Create | n8n service client |
| `lib/services/librechat.ts` | Create | LibreChat service client |
| `app/(auth)/settings/page.tsx` | Update | Connection status UI |
| `.env.example` | Update | Document all env vars |
| `README.md` | Update | Add connection setup docs |

## Environment Variables Required

```bash
# n8n Integration
N8N_WEBHOOK_URL="https://n8n.yourdomain.com/webhook"
N8N_WEBHOOK_SECRET="shared-secret-for-auth"

# LibreChat / MCP
LIBRECHAT_URL="https://chat.yourdomain.com"
LIBRECHAT_API_KEY="your-api-key"

# Already configured in Story 1.3
MICROSOFT_CLIENT_ID="..."
MICROSOFT_CLIENT_SECRET="..."
```

## Testing Requirements

### Manual Testing

1. **Health Endpoint**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Verify response includes all services with status

2. **Microsoft Connection**:
   - Log in to app
   - Go to Settings
   - Click "Test" on Microsoft Graph
   - Should show "Connected" with profile info

3. **n8n Connection**:
   - Ensure n8n is running with test workflow
   - Click "Test" on n8n
   - Should show "Connected"

4. **LibreChat Connection**:
   - Ensure LibreChat is running
   - Click "Test" on LibreChat
   - Should show "Connected"

### Edge Cases
- Test with n8n offline - should show "Disconnected"
- Test with expired Microsoft token - should refresh and connect
- Test with wrong webhook secret - should show auth error

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Health endpoint returns status for all services
- [ ] Microsoft Graph connection works (profile fetch)
- [ ] n8n webhook connection works (test workflow)
- [ ] LibreChat connection works (health check)
- [ ] Settings page shows all connection statuses
- [ ] Test buttons work for individual services
- [ ] Environment variables documented
- [ ] README updated with setup instructions
- [ ] Error messages are clear and actionable

## Notes & Decisions

- **Health endpoint is public**: Allows monitoring tools to check status without auth
- **5-second timeouts**: Prevent health checks from hanging
- **Parallel health checks**: All services checked concurrently for speed
- **Test workflow in n8n**: Simple ping/pong to verify connectivity

## Troubleshooting Guide

### Microsoft Graph Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `token_expired` | Access token expired | Should auto-refresh; re-login if persists |
| `insufficient_scope` | Missing permissions | Check Azure app registration |
| `network_error` | Can't reach Graph API | Check firewall/proxy settings |

### n8n Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | n8n not running | Start n8n instance |
| `401 Unauthorized` | Wrong webhook secret | Check N8N_WEBHOOK_SECRET |
| `timeout` | n8n slow/unresponsive | Check n8n resources/logs |

### LibreChat Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | LibreChat not running | Start LibreChat instance |
| `401 Unauthorized` | Wrong API key | Check LIBRECHAT_API_KEY |
| `404` | Wrong endpoint | Verify LibreChat API docs |

## Related Documentation

- [Architecture Document](../../architecture.md) - External API specs
- [n8n Documentation](https://docs.n8n.io/) - Workflow setup
- [Microsoft Graph Docs](https://docs.microsoft.com/en-us/graph/) - API reference
