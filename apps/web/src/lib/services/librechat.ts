export interface LibreChatResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const LIBRECHAT_TIMEOUT = 10000; // 10 seconds

function getLibreChatConfig() {
  const url = process.env.LIBRECHAT_URL;
  const apiKey = process.env.LIBRECHAT_API_KEY;

  return { url, apiKey };
}

/**
 * LibreChat/MCP service client
 */
export const libreChatService = {
  /**
   * Check if LibreChat is configured
   */
  isConfigured(): boolean {
    const { url } = getLibreChatConfig();
    return !!url;
  },

  /**
   * Test connection to LibreChat health endpoint
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const { url, apiKey } = getLibreChatConfig();

    if (!url) {
      return { success: false, error: "LIBRECHAT_URL not configured" };
    }

    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LIBRECHAT_TIMEOUT);

      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          latency: Date.now() - start,
        };
      }

      return {
        success: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { success: false, error: "Connection timeout" };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },

  /**
   * Send a request to LibreChat API
   */
  async request<T = unknown>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      data?: Record<string, unknown>;
    } = {}
  ): Promise<LibreChatResponse<T>> {
    const { url, apiKey } = getLibreChatConfig();

    if (!url) {
      return { success: false, error: "LIBRECHAT_URL not configured" };
    }

    const { method = "GET", data } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LIBRECHAT_TIMEOUT);

      const response = await fetch(`${url}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        ...(data && { body: JSON.stringify(data) }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const responseData = await response.json();
      return { success: true, data: responseData as T };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { success: false, error: "Request timeout" };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  },
};
