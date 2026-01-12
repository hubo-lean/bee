import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { n8nService } from "@/lib/services/n8n";
import { libreChatService } from "@/lib/services/librechat";
import { AIClassificationService } from "@/server/services/ai-classification.service";

interface ServiceStatus {
  status: "connected" | "disconnected" | "not_configured";
  latency?: number;
  error?: string;
  lastChecked: string;
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
      error: error instanceof Error ? error.message : "Connection failed",
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkN8n(): Promise<ServiceStatus> {
  if (!n8nService.isConfigured()) {
    return {
      status: "not_configured",
      lastChecked: new Date().toISOString(),
    };
  }

  const result = await n8nService.testConnection();
  return {
    status: result.success ? "connected" : "disconnected",
    latency: result.latency,
    error: result.error,
    lastChecked: new Date().toISOString(),
  };
}

async function checkLibreChat(): Promise<ServiceStatus> {
  if (!libreChatService.isConfigured()) {
    return {
      status: "not_configured",
      lastChecked: new Date().toISOString(),
    };
  }

  const result = await libreChatService.testConnection();
  return {
    status: result.success ? "connected" : "disconnected",
    latency: result.latency,
    error: result.error,
    lastChecked: new Date().toISOString(),
  };
}

// Story 7.2: Check OpenAI for AI classification
async function checkOpenAI(): Promise<ServiceStatus> {
  if (!AIClassificationService.isConfigured()) {
    return {
      status: "not_configured",
      lastChecked: new Date().toISOString(),
    };
  }

  const result = await AIClassificationService.testConnection();
  return {
    status: result.success ? "connected" : "disconnected",
    latency: result.latency,
    error: result.error,
    lastChecked: new Date().toISOString(),
  };
}

export async function GET() {
  const [database, n8n, librechat, openai] = await Promise.all([
    checkDatabase(),
    checkN8n(),
    checkLibreChat(),
    checkOpenAI(),
  ]);

  // Story 7.2: OpenAI is now required for classification (replaces n8n for this)
  // n8n is optional and only used for complex workflows
  const services = { database, n8n, librechat, openai };

  // Core services: database and OpenAI are required
  // Optional services: n8n, librechat
  const coreHealthy =
    database.status === "connected" &&
    (openai.status === "connected" || openai.status === "not_configured");

  // Check optional services
  const optionalServices = [n8n, librechat];
  const configuredOptional = optionalServices.filter((s) => s.status !== "not_configured");
  const optionalHealthy = configuredOptional.every((s) => s.status === "connected");

  let overallStatus: "healthy" | "degraded" | "unhealthy";

  if (!coreHealthy) {
    overallStatus = "unhealthy";
  } else if (configuredOptional.length === 0 || optionalHealthy) {
    overallStatus = "healthy";
  } else {
    overallStatus = "degraded";
  }

  const responseBody = {
    status: overallStatus,
    version: process.env.npm_package_version || "0.1.0",
    timestamp: new Date().toISOString(),
    services,
  };

  return NextResponse.json(responseBody, {
    status: overallStatus === "unhealthy" ? 503 : 200,
  });
}
