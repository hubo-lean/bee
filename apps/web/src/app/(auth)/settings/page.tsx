"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Workflow,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: string;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  isDefault: boolean;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

interface ServiceStatus {
  status: "connected" | "disconnected" | "not_configured";
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

export default function SettingsPage() {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "587",
    username: "",
    password: "",
    isDefault: false,
  });

  const fetchEmailAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts/email");
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Failed to fetch email accounts:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error("Failed to fetch health:", error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailAccounts();
    fetchHealth();
  }, [fetchEmailAccounts, fetchHealth]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/accounts/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: formData.imapHost,
          imapPort: parseInt(formData.imapPort),
          username: formData.username,
          password: formData.password,
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Failed to test connection" });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveAccount = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/accounts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          imapHost: formData.imapHost,
          imapPort: parseInt(formData.imapPort),
          smtpHost: formData.smtpHost,
          smtpPort: parseInt(formData.smtpPort),
          username: formData.username,
          password: formData.password,
          isDefault: formData.isDefault,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setFormData({
          name: "",
          email: "",
          imapHost: "",
          imapPort: "993",
          smtpHost: "",
          smtpPort: "587",
          username: "",
          password: "",
          isDefault: false,
        });
        setTestResult(null);
        fetchEmailAccounts();
      } else {
        const error = await response.json();
        setTestResult({ success: false, error: error.error });
      }
    } catch {
      setTestResult({ success: false, error: "Failed to save account" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this email account?")) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/email?id=${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchEmailAccounts();
      }
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleTestService = async (service: "n8n" | "librechat") => {
    try {
      await fetch(`/api/test-connection/${service}`, { method: "POST" });
      fetchHealth();
    } catch (error) {
      console.error(`Failed to test ${service}:`, error);
    }
  };

  const getStatusBadge = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Disconnected
          </Badge>
        );
      case "not_configured":
        return (
          <Badge variant="secondary">
            <AlertCircle className="mr-1 h-3 w-3" />
            Not Configured
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your connected accounts and system services
        </p>
      </div>

      {/* Email Accounts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Accounts
              </CardTitle>
              <CardDescription>
                Connect your email accounts to capture emails in Bee
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Email Account</DialogTitle>
                  <DialogDescription>
                    Enter your IMAP credentials to connect your email
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Account Name</Label>
                      <Input
                        id="name"
                        placeholder="Work Email"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imapHost">IMAP Host</Label>
                      <Input
                        id="imapHost"
                        placeholder="imap.gmail.com"
                        value={formData.imapHost}
                        onChange={(e) =>
                          setFormData({ ...formData, imapHost: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imapPort">IMAP Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        placeholder="993"
                        value={formData.imapPort}
                        onChange={(e) =>
                          setFormData({ ...formData, imapPort: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.gmail.com"
                        value={formData.smtpHost}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpHost: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        value={formData.smtpPort}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpPort: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="you@example.com"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password / App Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  {testResult && (
                    <div
                      className={`rounded-md p-3 text-sm ${
                        testResult.success
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {testResult.success
                        ? "Connection successful!"
                        : `Error: ${testResult.error}`}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || isSaving}
                  >
                    {isTestingConnection && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    onClick={handleSaveAccount}
                    disabled={isSaving || !testResult?.success}
                  >
                    {isSaving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingAccounts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : emailAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2">No email accounts connected</p>
              <p className="text-sm">
                Add an account to start capturing emails
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        {account.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{account.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {account.syncStatus === "error" && account.lastSyncError && (
                      <span className="text-xs text-red-500">
                        {account.lastSyncError}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Services Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Services</CardTitle>
              <CardDescription>
                Status of connected backend services
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={fetchHealth}
              disabled={isLoadingHealth}
            >
              {isLoadingHealth ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHealth && !health ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : health ? (
            <div className="space-y-3">
              {/* Database */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <Database className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <span className="font-medium">Database</span>
                    <p className="text-sm text-gray-500">PostgreSQL (Supabase)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {health.services.database.latency && (
                    <span className="text-xs text-gray-400">
                      {health.services.database.latency}ms
                    </span>
                  )}
                  {getStatusBadge(health.services.database.status)}
                </div>
              </div>

              {/* n8n */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <Workflow className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <span className="font-medium">n8n</span>
                    <p className="text-sm text-gray-500">Workflow Automation</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {health.services.n8n.error && (
                    <span className="text-xs text-red-500 max-w-[200px] truncate">
                      {health.services.n8n.error}
                    </span>
                  )}
                  {health.services.n8n.latency && (
                    <span className="text-xs text-gray-400">
                      {health.services.n8n.latency}ms
                    </span>
                  )}
                  {getStatusBadge(health.services.n8n.status)}
                  {health.services.n8n.status !== "not_configured" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestService("n8n")}
                    >
                      Test
                    </Button>
                  )}
                </div>
              </div>

              {/* LibreChat */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <span className="font-medium">LibreChat</span>
                    <p className="text-sm text-gray-500">AI Chat / MCP</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {health.services.librechat.error && (
                    <span className="text-xs text-red-500 max-w-[200px] truncate">
                      {health.services.librechat.error}
                    </span>
                  )}
                  {health.services.librechat.latency && (
                    <span className="text-xs text-gray-400">
                      {health.services.librechat.latency}ms
                    </span>
                  )}
                  {getStatusBadge(health.services.librechat.status)}
                  {health.services.librechat.status !== "not_configured" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestService("librechat")}
                    >
                      Test
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load service status
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
