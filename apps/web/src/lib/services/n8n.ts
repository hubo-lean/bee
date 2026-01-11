export interface N8nResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const N8N_TIMEOUT = 10000; // 10 seconds

function getN8nConfig() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  return { webhookUrl, webhookSecret };
}

/**
 * n8n service client for webhook interactions
 */
// Classification request payload
export interface ClassificationRequest {
  inboxItemId: string;
  content: string;
  source: string;
  type: string;
  createdAt: string;
  callbackUrl: string;
}

// Classification trigger response
export interface ClassificationTriggerResponse {
  acknowledged: boolean;
  workflowId?: string;
}

export const n8nService = {
  /**
   * Check if n8n is configured
   */
  isConfigured(): boolean {
    const { webhookUrl } = getN8nConfig();
    return !!webhookUrl;
  },

  /**
   * Test connection to n8n webhook endpoint
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const { webhookUrl, webhookSecret } = getN8nConfig();

    if (!webhookUrl) {
      return { success: false, error: "N8N_WEBHOOK_URL not configured" };
    }

    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);

      const response = await fetch(`${webhookUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret && { "X-Webhook-Secret": webhookSecret }),
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
   * Send a webhook request to n8n
   */
  async sendWebhook<T = unknown>(
    path: string,
    data: Record<string, unknown>
  ): Promise<N8nResponse<T>> {
    const { webhookUrl, webhookSecret } = getN8nConfig();

    if (!webhookUrl) {
      return { success: false, error: "N8N_WEBHOOK_URL not configured" };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);

      const response = await fetch(`${webhookUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret && { "X-Webhook-Secret": webhookSecret }),
        },
        body: JSON.stringify(data),
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

  /**
   * Trigger classification workflow for an inbox item
   */
  async triggerClassification(
    inboxItem: {
      id: string;
      content: string;
      source: string;
      type: string;
      createdAt: Date;
    }
  ): Promise<N8nResponse<ClassificationTriggerResponse>> {
    const classifyWebhookUrl = process.env.N8N_CLASSIFY_WEBHOOK_URL;

    // If no classification webhook URL, use default path
    const webhookPath = classifyWebhookUrl
      ? ""
      : "/classify-inbox-item";

    const callbackUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/classification-complete`;

    const payload: ClassificationRequest = {
      inboxItemId: inboxItem.id,
      content: inboxItem.content,
      source: inboxItem.source,
      type: inboxItem.type,
      createdAt: inboxItem.createdAt.toISOString(),
      callbackUrl,
    };

    // If dedicated classification URL is set, use it directly
    if (classifyWebhookUrl) {
      return this.sendToUrl<ClassificationTriggerResponse>(
        classifyWebhookUrl,
        payload as unknown as Record<string, unknown>
      );
    }

    return this.sendWebhook<ClassificationTriggerResponse>(webhookPath, payload as unknown as Record<string, unknown>);
  },

  /**
   * Send to a specific URL (for dedicated webhook endpoints)
   */
  async sendToUrl<T = unknown>(
    url: string,
    data: Record<string, unknown>
  ): Promise<N8nResponse<T>> {
    const { webhookSecret } = getN8nConfig();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret && { "X-Webhook-Secret": webhookSecret }),
        },
        body: JSON.stringify(data),
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
