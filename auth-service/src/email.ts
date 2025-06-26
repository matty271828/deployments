// Email service for sending emails via Brevo REST API
export class EmailService {
  private apiKey: string;

  constructor(apiKey?: string) {
    console.log(`[EMAIL SERVICE] Initializing EmailService with Brevo REST API`);
    this.apiKey = apiKey || '';
  }

  /**
   * Send email via Brevo REST API
   */
  private async sendEmail(emailData: any): Promise<any> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${domain}</title>
          <meta name="description" content="Welcome to ${domain}! Your account is ready and you're all set to get started.">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 24px; font-weight: bold;">✓</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome to ${domain}</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your account is ready!</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; margin: 0 0 20px 0; color: #2c3e50;">Hi ${firstName},</p>
              
              <p style="font-size: 16px; margin: 0 0 20px 0; color: #555;">
                Thank you for joining ${domain}! We're excited to have you on board.
              </p>
              
              <p style="font-size: 16px; margin: 0 0 30px 0; color: #555;">
                Your account has been successfully created and you're all set to get started.
              </p>
              
              <!-- Account Verification -->
              <div style="background-color: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">Verify Your Account</h3>
                <p style="margin: 0 0 15px 0; color: #155724; font-size: 14px;">
                  To ensure the security of your account, please verify your email address by clicking the button below.
                </p>
                <div style="text-align: center;">
                  <a href="https://${domain}/verify-email?token=PLACEHOLDER_TOKEN" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);">
                    Verify Email →
                  </a>
                </div>
              </div>
              
              <!-- Next Steps -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">What's next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #555;">
                  <li>Explore your dashboard</li>
                  <li>Complete your profile</li>
                  <li>Check out our getting started guide</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://${domain}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease; border: none;">
                  Get Started →
                </a>
              </div>
              
              <p style="font-size: 16px; margin: 30px 0 20px 0; color: #555;">
                If you have any questions or need help getting started, our support team is here to help.
              </p>
              
              <p style="font-size: 16px; margin: 0; color: #555;">
                Welcome aboard!<br>
                <strong>The ${domain} Team</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="font-size: 12px; color: #6c757d; margin: 0;">
                This email was sent to ${toEmail} from ${domain}.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textBody = `
Welcome to ${domain}!

Hi ${firstName},

Thank you for joining ${domain}! We're excited to have you on board.

Your account has been successfully created and you're all set to get started.

VERIFY YOUR ACCOUNT:
To ensure the security of your account, please verify your email address by visiting:
https://${domain}/verify-email?token=PLACEHOLDER_TOKEN

Visit https://${domain} to begin using our services.

If you have any questions or need help getting started, our support team is here to help.

Welcome aboard!
The ${domain} Team

---
This email was sent to ${toEmail} from ${domain}. Please do not reply to this email.
      `;

      const emailData = {
        to: [{ email: toEmail, name: `${firstName} ${lastName}` }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: textBody,
      };

      console.log(`[EMAIL] Sending signup confirmation | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);

      const result = await this.sendEmail(emailData);
      
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - ${domain}</title>
          <meta name="description" content="Reset your password for your ${domain} account. This link will expire in 1 hour.">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 40px 20px; text-align: center;">
              <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 24px; font-weight: bold;">🔒</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Password Reset</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Secure your account</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; margin: 0 0 20px 0; color: #2c3e50;">Hi ${firstName},</p>
              
              <p style="font-size: 16px; margin: 0 0 20px 0; color: #555;">
                We received a request to reset your password for your ${domain} account.
              </p>
              
              <p style="font-size: 16px; margin: 0 0 30px 0; color: #555;">
                Click the button below to securely reset your password. This link will expire in 1 hour.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4); transition: all 0.3s ease; border: none;">
                  Reset Password →
                </a>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">Security Notice</h3>
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>
              
              <p style="font-size: 16px; margin: 30px 0 20px 0; color: #555;">
                If you have any questions or need assistance, our support team is here to help.
              </p>
              
              <p style="font-size: 16px; margin: 0; color: #555;">
                Stay secure!<br>
                <strong>The ${domain} Team</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="font-size: 12px; color: #6c757d; margin: 0;">
                This email was sent to ${toEmail} from ${domain}.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textBody = `
Password Reset Request - ${domain}

Hi ${firstName},

We received a request to reset your password for your ${domain} account.

Click the link below to securely reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

If you have any questions or need assistance, our support team is here to help.

Stay secure!
The ${domain} Team

---
This email was sent to ${toEmail} from ${domain}. Please do not reply to this email.
      `;

      const emailData = {
        to: [{ email: toEmail, name: `${firstName} ${lastName}` }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: textBody,
      };

      console.log(`[EMAIL] Sending password reset | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject} | Reset URL: ${resetUrl}`);

      const result = await this.sendEmail(emailData);
      
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

      const emailData = {
        to: [{ email: toEmail }],
        sender: { email: `noreply@${domain}`, name: domain },
        subject: subject,
        htmlContent: htmlBody,
        textContent: message,
      };

      console.log(`[EMAIL] Sending notification | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);

      const result = await this.sendEmail(emailData);
      
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