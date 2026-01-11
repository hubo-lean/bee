import { prisma } from "@packages/db";
import { encrypt, decrypt } from "@/lib/encryption";
import Imap from "imap";

export interface ImapConfig {
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

export interface TestConnectionResult {
  success: boolean;
  error?: string;
}

export const accountService = {
  /**
   * Test IMAP connection with provided credentials
   */
  async testImapConnection(config: ImapConfig): Promise<TestConnectionResult> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
        authTimeout: 10000,
      });

      const timeout = setTimeout(() => {
        imap.end();
        resolve({ success: false, error: "Connection timeout" });
      }, 15000);

      imap.once("ready", () => {
        clearTimeout(timeout);
        imap.end();
        resolve({ success: true });
      });

      imap.once("error", (err: Error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      imap.connect();
    });
  },

  /**
   * Add IMAP email account with encrypted credentials
   */
  async addImapEmailAccount(userId: string, config: ImapConfig) {
    // Test connection before saving
    const testResult = await this.testImapConnection(config);
    if (!testResult.success) {
      throw new Error(`Connection failed: ${testResult.error}`);
    }

    // If setting as default, unset other defaults
    if (config.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
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
        password: encrypt(config.password),
        isDefault: config.isDefault ?? false,
        syncStatus: "idle",
      },
    });
  },

  /**
   * Add OAuth email account (Microsoft/Google)
   */
  async addOAuthEmailAccount(
    userId: string,
    data: {
      name: string;
      email: string;
      provider: "microsoft_oauth" | "google_oauth";
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      isDefault?: boolean;
    }
  ) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        name: data.name,
        email: data.email,
        provider: data.provider,
        oauthAccessToken: encrypt(data.accessToken),
        oauthRefreshToken: encrypt(data.refreshToken),
        oauthExpiresAt: data.expiresAt,
        isDefault: data.isDefault ?? false,
        syncStatus: "idle",
      },
    });
  },

  /**
   * Get email accounts for user (without sensitive data)
   */
  async getEmailAccounts(userId: string) {
    return prisma.emailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        isDefault: true,
        syncStatus: true,
        lastSyncAt: true,
        lastSyncError: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  /**
   * Delete email account
   */
  async deleteEmailAccount(userId: string, accountId: string) {
    const result = await prisma.emailAccount.deleteMany({
      where: { id: accountId, userId },
    });
    return result.count > 0;
  },

  /**
   * Get decrypted email credentials (internal use only)
   */
  async getEmailCredentials(userId: string, accountId: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return null;
    }

    if (account.provider === "imap" && account.password) {
      return {
        ...account,
        password: decrypt(account.password),
      };
    }

    if (
      (account.provider === "microsoft_oauth" ||
        account.provider === "google_oauth") &&
      account.oauthAccessToken
    ) {
      return {
        ...account,
        oauthAccessToken: decrypt(account.oauthAccessToken),
        oauthRefreshToken: account.oauthRefreshToken
          ? decrypt(account.oauthRefreshToken)
          : null,
      };
    }

    return account;
  },

  /**
   * Update email account sync status
   */
  async updateSyncStatus(
    accountId: string,
    status: "idle" | "syncing" | "error",
    error?: string
  ) {
    return prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        syncStatus: status,
        lastSyncAt: status === "idle" ? new Date() : undefined,
        lastSyncError: error || null,
      },
    });
  },

  /**
   * Test existing email account connection
   */
  async testExistingEmailAccount(
    userId: string,
    accountId: string
  ): Promise<TestConnectionResult> {
    const credentials = await this.getEmailCredentials(userId, accountId);

    if (!credentials) {
      return { success: false, error: "Account not found" };
    }

    if (credentials.provider !== "imap") {
      // For OAuth accounts, we'd need to validate the token
      return { success: true };
    }

    if (
      !credentials.imapHost ||
      !credentials.imapPort ||
      !credentials.username ||
      !credentials.password
    ) {
      return { success: false, error: "Missing IMAP credentials" };
    }

    return this.testImapConnection({
      name: credentials.name,
      email: credentials.email,
      imapHost: credentials.imapHost,
      imapPort: credentials.imapPort,
      smtpHost: credentials.smtpHost || "",
      smtpPort: credentials.smtpPort || 587,
      username: credentials.username,
      password: credentials.password,
    });
  },
};
