declare module '@getbrevo/brevo' {
  export class ApiClient {
    constructor();
    setApiKey(key: string, value: string): void;
  }

  export class TransactionalEmailsApi {
    constructor(client: ApiClient);
    sendTransacEmail(emailData: SendSmtpEmail): Promise<{ messageId: string }>;
  }

  export interface SendSmtpEmail {
    to: Array<{ email: string; name?: string }>;
    sender: { email: string; name?: string };
    subject: string;
    htmlContent?: string;
    textContent?: string;
    templateId?: number;
    params?: Record<string, any>;
  }
} 