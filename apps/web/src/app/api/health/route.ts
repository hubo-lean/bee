import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { n8nService } from "@/lib/services/n8n";
import { libreChatService } from "@/lib/services/librechat";

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

export async function GET() {
  const [database, n8n, librechat] = await Promise.all([
    checkDatabase(),
    checkN8n(),
    checkLibreChat(),
  ]);

  const services = { database, n8n, librechat };

  // Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  const configuredServices = statuses.filter((s) => s !== "not_configured");

  let overallStatus: "healthy" | "degraded" | "unhealthy";

  if (configuredServices.length === 0) {
    // Only database is configured, and everything else is optional
    overallStatus = database.status === "connected" ? "healthy" : "unhealthy";
  } else if (configuredServices.every((s) => s === "connected")) {
    overallStatus = "healthy";
  } else if (configuredServices.some((s) => s === "connected")) {
    overallStatus = "degraded";
  } else {
    overallStatus = "unhealthy";
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
