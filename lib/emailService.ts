import { db } from "../public/src/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";

export interface EmailMessage {
  id: string;
  userId: string;
  from: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  sentAt: Date;
  receivedAt?: Date;
  provider: "gmail" | "outlook" | "draft";
  messageId?: string;
  threadId?: string;
  labels?: string[];
  isRead: boolean;
  isDraft: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  size: number;
  mimeType: string;
  data?: string;
  url?: string;
}

export interface DraftEmail {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  suggestions?: string[];
  createdAt: Date;
  autoSuggestedAt?: Date;
}

export interface EmailSettings {
  userId: string;
  gmailConnected: boolean;
  gmailAccessToken?: string;
  gmailRefreshToken?: string;
  outlookConnected: boolean;
  outlookAccessToken?: string;
  outlookRefreshToken?: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: Date;
  inboxLabels: string[];
  aiDraftAssistant: boolean;
  autoReplyEnabled: boolean;
  autoReplyTemplate?: string;
}

/**
 * EmailService: Manages email integration with Gmail and Outlook
 * Handles drafting, sending, syncing, and AI-assisted composition
 */
class EmailServiceClass {
  private static instance: EmailServiceClass;

  private constructor() {}

  static getInstance(): EmailServiceClass {
    if (!EmailServiceClass.instance) {
      EmailServiceClass.instance = new EmailServiceClass();
    }
    return EmailServiceClass.instance;
  }

  /**
   * Initialize email settings for user
   */
  async initializeSettings(userId: string): Promise<EmailSettings> {
    const settings: EmailSettings = {
      userId,
      gmailConnected: false,
      outlookConnected: false,
      autoSyncEnabled: true,
      syncIntervalMinutes: 15,
      inboxLabels: ["INBOX"],
      aiDraftAssistant: true,
      autoReplyEnabled: false,
    };

    await this.saveSettings(userId, settings);
    return settings;
  }

  /**
   * Save email settings to Firestore
   */
  async saveSettings(userId: string, settings: EmailSettings): Promise<void> {
    try {
      const settingsRef = doc(db, `users/${userId}/settings/email`);
      await updateDoc(settingsRef, {
        ...settings,
        lastUpdated: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error saving email settings:", error);
      throw error;
    }
  }

  /**
   * Get email settings for user
   */
  async getSettings(userId: string): Promise<EmailSettings | null> {
    try {
      const settingsRef = doc(db, `users/${userId}/settings/email`);
      const snapshot = await getDocs(collection(db, `users/${userId}/settings`));
      const emailSettings = snapshot.docs.find((d) => d.id === "email");
      return emailSettings?.data() as EmailSettings | null;
    } catch (error) {
      console.error("Error getting email settings:", error);
      return null;
    }
  }

  /**
   * Connect Gmail account (OAuth flow handler)
   */
  async connectGmail(
    userId: string,
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    try {
      const settings = (await this.getSettings(userId)) || {
        userId,
        gmailConnected: false,
        outlookConnected: false,
        autoSyncEnabled: true,
        syncIntervalMinutes: 15,
        inboxLabels: ["INBOX"],
        aiDraftAssistant: true,
        autoReplyEnabled: false,
      };

      settings.gmailConnected = true;
      settings.gmailAccessToken = accessToken;
      settings.gmailRefreshToken = refreshToken;

      await this.saveSettings(userId, settings);

      // Trigger initial sync
      await this.syncGmailInbox(userId, accessToken);
    } catch (error) {
      console.error("Error connecting Gmail:", error);
      throw error;
    }
  }

  /**
   * Connect Outlook account (OAuth flow handler)
   */
  async connectOutlook(
    userId: string,
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    try {
      const settings = (await this.getSettings(userId)) || {
        userId,
        gmailConnected: false,
        outlookConnected: false,
        autoSyncEnabled: true,
        syncIntervalMinutes: 15,
        inboxLabels: ["INBOX"],
        aiDraftAssistant: true,
        autoReplyEnabled: false,
      };

      settings.outlookConnected = true;
      settings.outlookAccessToken = accessToken;
      settings.outlookRefreshToken = refreshToken;

      await this.saveSettings(userId, settings);

      // Trigger initial sync
      await this.syncOutlookInbox(userId, accessToken);
    } catch (error) {
      console.error("Error connecting Outlook:", error);
      throw error;
    }
  }

  /**
   * Sync Gmail inbox to Firestore
   */
  async syncGmailInbox(userId: string, accessToken: string): Promise<number> {
    try {
      // Call Gmail API to fetch messages
      const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error("Gmail API error");

      const data = (await response.json()) as { messages?: Array<{ id: string }> };
      const messages = data.messages || [];
      let syncedCount = 0;

      for (const msg of messages) {
        const msgResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (msgResponse.ok) {
          const msgData = (await msgResponse.json()) as Record<string, any>;
          const emailMsg = this.parseGmailMessage(userId, msgData);
          await this.saveEmailMessage(userId, emailMsg);
          syncedCount++;
        }
      }

      // Update sync time
      const settings = (await this.getSettings(userId)) || {
        userId,
        gmailConnected: true,
        outlookConnected: false,
        autoSyncEnabled: true,
        syncIntervalMinutes: 15,
        inboxLabels: ["INBOX"],
        aiDraftAssistant: true,
        autoReplyEnabled: false,
      };
      settings.lastSyncAt = new Date();
      await this.saveSettings(userId, settings);

      return syncedCount;
    } catch (error) {
      console.error("Error syncing Gmail inbox:", error);
      return 0;
    }
  }

  /**
   * Sync Outlook inbox to Firestore
   */
  async syncOutlookInbox(userId: string, accessToken: string): Promise<number> {
    try {
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error("Outlook API error");

      const data = (await response.json()) as { value?: Array<Record<string, any>> };
      const messages = data.value || [];
      let syncedCount = 0;

      for (const msgData of messages) {
        const emailMsg = this.parseOutlookMessage(userId, msgData);
        await this.saveEmailMessage(userId, emailMsg);
        syncedCount++;
      }

      // Update sync time
      const settings = (await this.getSettings(userId)) || {
        userId,
        gmailConnected: false,
        outlookConnected: true,
        autoSyncEnabled: true,
        syncIntervalMinutes: 15,
        inboxLabels: ["INBOX"],
        aiDraftAssistant: true,
        autoReplyEnabled: false,
      };
      settings.lastSyncAt = new Date();
      await this.saveSettings(userId, settings);

      return syncedCount;
    } catch (error) {
      console.error("Error syncing Outlook inbox:", error);
      return 0;
    }
  }

  /**
   * Parse Gmail message to EmailMessage format
   */
  private parseGmailMessage(userId: string, gmailMsg: Record<string, any>): EmailMessage {
    const headers = gmailMsg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name === name)?.value || "";

    return {
      id: gmailMsg.id,
      userId,
      from: getHeader("From"),
      to: getHeader("To").split(",").map((e: string) => e.trim()),
      cc: getHeader("Cc")
        ?.split(",")
        .map((e: string) => e.trim())
        .filter(Boolean),
      subject: getHeader("Subject"),
      body: gmailMsg.snippet || "",
      provider: "gmail",
      messageId: gmailMsg.id,
      threadId: gmailMsg.threadId,
      labels: gmailMsg.labelIds || [],
      isRead: !gmailMsg.labelIds?.includes("UNREAD"),
      isDraft: gmailMsg.labelIds?.includes("DRAFT") || false,
      sentAt: new Date(parseInt(gmailMsg.internalDate)),
    };
  }

  /**
   * Parse Outlook message to EmailMessage format
   */
  private parseOutlookMessage(userId: string, outlookMsg: Record<string, any>): EmailMessage {
    return {
      id: outlookMsg.id,
      userId,
      from: outlookMsg.from?.emailAddress?.address || "",
      to: outlookMsg.toRecipients?.map((r: any) => r.emailAddress.address) || [],
      cc: outlookMsg.ccRecipients?.map((r: any) => r.emailAddress.address),
      subject: outlookMsg.subject,
      body: outlookMsg.bodyPreview || outlookMsg.body?.content || "",
      htmlBody: outlookMsg.body?.content,
      provider: "outlook",
      messageId: outlookMsg.id,
      isRead: outlookMsg.isRead,
      isDraft: outlookMsg.isDraft,
      sentAt: new Date(outlookMsg.sentDateTime),
      receivedAt: new Date(outlookMsg.receivedDateTime),
    };
  }

  /**
   * Save email message to Firestore
   */
  async saveEmailMessage(userId: string, email: EmailMessage): Promise<string> {
    try {
      const messagesRef = collection(db, `users/${userId}/emails`);
      const docRef = await addDoc(messagesRef, {
        ...email,
        sentAt: Timestamp.fromDate(email.sentAt),
        receivedAt: email.receivedAt ? Timestamp.fromDate(email.receivedAt) : null,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving email message:", error);
      throw error;
    }
  }

  /**
   * Get inbox messages for user
   */
  async getInboxMessages(userId: string, limit_count: number = 20): Promise<EmailMessage[]> {
    try {
      const messagesRef = collection(db, `users/${userId}/emails`);
      const q = query(
        messagesRef,
        where("isDraft", "==", false),
        orderBy("sentAt", "desc"),
        limit(limit_count)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          sentAt: data.sentAt?.toDate(),
          receivedAt: data.receivedAt?.toDate(),
        } as EmailMessage;
      });
    } catch (error) {
      console.error("Error getting inbox messages:", error);
      return [];
    }
  }

  /**
   * Get draft emails for user
   */
  async getDrafts(userId: string): Promise<EmailMessage[]> {
    try {
      const messagesRef = collection(db, `users/${userId}/emails`);
      const q = query(
        messagesRef,
        where("isDraft", "==", true),
        orderBy("sentAt", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          sentAt: data.sentAt?.toDate(),
          receivedAt: data.receivedAt?.toDate(),
        } as EmailMessage;
      });
    } catch (error) {
      console.error("Error getting drafts:", error);
      return [];
    }
  }

  /**
   * Send email via Gmail API
   */
  async sendViaGmail(
    userId: string,
    accessToken: string,
    email: Partial<EmailMessage>
  ): Promise<string> {
    try {
      const raw = this.createRawMessage(
        email.from || "",
        email.to as string[],
        email.subject || "",
        email.body || "",
        email.cc,
        email.bcc
      );

      const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ raw }),
        }
      );

      if (!response.ok) throw new Error("Failed to send email via Gmail");

      const data = (await response.json()) as { id: string };

      // Save sent message
      const emailMsg: EmailMessage = {
        id: data.id,
        userId,
        from: email.from || "",
        to: email.to || [],
        cc: email.cc,
        subject: email.subject || "",
        body: email.body || "",
        provider: "gmail",
        messageId: data.id,
        isRead: true,
        isDraft: false,
        sentAt: new Date(),
      };

      await this.saveEmailMessage(userId, emailMsg);
      return data.id;
    } catch (error) {
      console.error("Error sending email via Gmail:", error);
      throw error;
    }
  }

  /**
   * Send email via Outlook API
   */
  async sendViaOutlook(
    userId: string,
    accessToken: string,
    email: Partial<EmailMessage>
  ): Promise<string> {
    try {
      const payload = {
        message: {
          subject: email.subject,
          body: { contentType: "HTML", content: email.htmlBody || email.body },
          toRecipients: (email.to as string[]).map((addr) => ({
            emailAddress: { address: addr },
          })),
          ccRecipients: email.cc?.map((addr) => ({
            emailAddress: { address: addr },
          })),
          bccRecipients: email.bcc?.map((addr) => ({
            emailAddress: { address: addr },
          })),
        },
      };

      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to send email via Outlook");

      // Outlook doesn't return the message ID on send, generate one
      const messageId = `outlook_${Date.now()}`;

      const emailMsg: EmailMessage = {
        id: messageId,
        userId,
        from: email.from || "",
        to: email.to || [],
        cc: email.cc,
        subject: email.subject || "",
        body: email.body || "",
        htmlBody: email.htmlBody,
        provider: "outlook",
        messageId,
        isRead: true,
        isDraft: false,
        sentAt: new Date(),
      };

      await this.saveEmailMessage(userId, emailMsg);
      return messageId;
    } catch (error) {
      console.error("Error sending email via Outlook:", error);
      throw error;
    }
  }

  /**
   * Create raw message format for Gmail API
   */
  private createRawMessage(
    from: string,
    to: string[],
    subject: string,
    body: string,
    cc?: string[],
    bcc?: string[]
  ): string {
    const headers = [
      `From: ${from}`,
      `To: ${to.join(", ")}`,
      cc && cc.length > 0 ? `Cc: ${cc.join(", ")}` : null,
      bcc && bcc.length > 0 ? `Bcc: ${bcc.join(", ")}` : null,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
    ]
      .filter(Boolean)
      .join("\r\n");

    const message = `${headers}\r\n\r\n${body}`;
    return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  }

  /**
   * Mark email as read
   */
  async markAsRead(userId: string, emailId: string): Promise<void> {
    try {
      const emailRef = doc(db, `users/${userId}/emails/${emailId}`);
      await updateDoc(emailRef, { isRead: true });
    } catch (error) {
      console.error("Error marking email as read:", error);
      throw error;
    }
  }

  /**
   * Delete email
   */
  async deleteEmail(userId: string, emailId: string): Promise<void> {
    try {
      const emailRef = doc(db, `users/${userId}/emails/${emailId}`);
      await updateDoc(emailRef, { deleted: true });
    } catch (error) {
      console.error("Error deleting email:", error);
      throw error;
    }
  }
}

export const emailService = EmailServiceClass.getInstance();
