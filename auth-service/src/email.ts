import { ApiClient, TransactionalEmailsApi, SendSmtpEmail } from '@getbrevo/brevo';

// Email service for sending emails via Brevo
export class EmailService {
  private brevoClient: ApiClient;
  private transactionalApi: TransactionalEmailsApi;

  constructor(apiKey?: string) {
    console.log(`[EMAIL SERVICE] Initializing EmailService with Brevo`);
    
    // Initialize Brevo client
    this.brevoClient = new ApiClient();
    if (apiKey) {
      this.brevoClient.setApiKey('api-key', apiKey);
    }
    
    this.transactionalApi = new TransactionalEmailsApi(this.brevoClient);
  }

  /**
   * Send a signup confirmation email
   */
  async sendSignupConfirmation(
    toEmail: string, 
    firstName: string, 
    lastName: string, 
    domain: string
  ): Promise<boolean> {
    console.log(`[EMAIL] Starting signup confirmation | To: ${toEmail} | Domain: ${domain} | Name: ${firstName} ${lastName}`);
    
    try {
      const subject = `Welcome to ${domain}!`;
      
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to ${domain}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; text-align: center;">Welcome to ${domain}!</h1>
            
            <p>Hi ${firstName} ${lastName},</p>
            
            <p>Thank you for signing up with ${domain}! Your account has been successfully created.</p>
            
            <p>You can now log in to your account and start using our services.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Account Details:</strong></p>
              <p style="margin: 5px 0;">Email: ${toEmail}</p>
              <p style="margin: 5px 0;">Domain: ${domain}</p>
            </div>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>The ${domain} Team</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666; text-align: center;">
              This email was sent from ${domain}. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      const textBody = `
Welcome to ${domain}!

Hi ${firstName} ${lastName},

Thank you for signing up with ${domain}! Your account has been successfully created.

You can now log in to your account and start using our services.

Account Details:
- Email: ${toEmail}
- Domain: ${domain}

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The ${domain} Team

---
This email was sent from ${domain}. Please do not reply to this email.
      `;

      const emailData: SendSmtpEmail = {
        to: [{ email: toEmail, name: `${firstName} ${lastName}` }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: textBody,
      };

      console.log(`[EMAIL] Sending signup confirmation | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);

      const result = await this.transactionalApi.sendTransacEmail(emailData);
      
      console.log(`[EMAIL] Signup confirmation sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] Failed to send signup confirmation | To: ${toEmail} | Domain: ${domain} | Error: ${error.message} | Type: ${error.name || 'Unknown'}`);
      throw error;
    }
  }

  /**
   * Send a password reset email
   */
  async sendPasswordReset(
    toEmail: string, 
    firstName: string, 
    lastName: string, 
    domain: string,
    resetToken: string
  ): Promise<boolean> {
    console.log(`[EMAIL] Starting password reset | To: ${toEmail} | Domain: ${domain} | Name: ${firstName} ${lastName}`);
    
    try {
      const resetUrl = `https://${domain}/reset-password?token=${resetToken}`;
      const subject = `Password Reset Request - ${domain}`;
      
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset - ${domain}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; text-align: center;">Password Reset Request</h1>
            
            <p>Hi ${firstName} ${lastName},</p>
            
            <p>We received a request to reset your password for your ${domain} account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            
            <p>This link will expire in 1 hour for security reasons.</p>
            
            <p>Best regards,<br>The ${domain} Team</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666; text-align: center;">
              This email was sent from ${domain}. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      const textBody = `
Password Reset Request - ${domain}

Hi ${firstName} ${lastName},

We received a request to reset your password for your ${domain} account.

To reset your password, please visit the following link:
${resetUrl}

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

This link will expire in 1 hour for security reasons.

Best regards,
The ${domain} Team

---
This email was sent from ${domain}. Please do not reply to this email.
      `;

      const emailData: SendSmtpEmail = {
        to: [{ email: toEmail, name: `${firstName} ${lastName}` }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: textBody,
      };

      console.log(`[EMAIL] Sending password reset | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject} | Reset URL: ${resetUrl}`);

      const result = await this.transactionalApi.sendTransacEmail(emailData);
      
      console.log(`[EMAIL] Password reset sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] Failed to send password reset | To: ${toEmail} | Domain: ${domain} | Error: ${error.message} | Type: ${error.name || 'Unknown'}`);
      throw error;
    }
  }

  /**
   * Send a generic notification email
   */
  async sendNotification(
    toEmail: string,
    subject: string,
    message: string,
    domain: string
  ): Promise<boolean> {
    console.log(`[EMAIL] Starting notification | To: ${toEmail} | Domain: ${domain} | Subject: ${subject}`);
    
    try {
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; text-align: center;">${subject}</h1>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            <p>Best regards,<br>The ${domain} Team</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666; text-align: center;">
              This email was sent from ${domain}. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `;

      const emailData: SendSmtpEmail = {
        to: [{ email: toEmail }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: message,
      };

      console.log(`[EMAIL] Sending notification | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);

      const result = await this.transactionalApi.sendTransacEmail(emailData);
      
      console.log(`[EMAIL] Notification sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] Failed to send notification | To: ${toEmail} | Domain: ${domain} | Error: ${error.message} | Type: ${error.name || 'Unknown'}`);
      throw error;
    }
  }
}

/**
 * Create an email service instance from environment variables
 */
export function createEmailService(env: any): EmailService {
  const apiKey = env.BREVO_API_KEY;
  return new EmailService(apiKey);
} 