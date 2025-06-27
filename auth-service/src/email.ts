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
    domain: string,
    verificationToken: string
  ): Promise<boolean> {
    console.log(`[EMAIL] Starting signup confirmation | To: ${toEmail} | Domain: ${domain} | Name: ${firstName} ${lastName}`);
    
    try {
      const verifyUrl = `https://${domain}/verify-email?token=${verificationToken}`;
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
            <div style="background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%); padding: 40px 20px; text-align: center;">
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
                  <a href="${verifyUrl}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);">
                    Verify Email →
                  </a>
                </div>
              </div>
              
              <p style="font-size: 16px; margin: 30px 0 20px 0; color: #555;">
                Once you've verified your email, you'll have full access to all features and can start exploring what ${domain} has to offer. We're committed to providing you with a secure and seamless experience.
              </p>
              
              <p style="font-size: 16px; margin: 20px 0; color: #555;">
                If you have any questions or need help getting started, our support team is here to help. You can reach us anytime at <a href="mailto:support@${domain}" style="color: #4a5568; text-decoration: underline;">support@${domain}</a>, and we'll be happy to assist you.
              </p>
              
              <p style="font-size: 16px; margin: 0; color: #555;">
                Welcome aboard!<br>
                <strong>The ${domain} team</strong>
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
${verifyUrl}

Once you've verified your email, you'll have full access to all features and can start exploring what ${domain} has to offer. We're committed to providing you with a secure and seamless experience.

If you have any questions or need help getting started, our support team is here to help. You can reach us anytime at support@${domain}, and we'll be happy to assist you.

Welcome aboard!
The ${domain} team

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

      console.log(`[EMAIL] Sending signup confirmation | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject} | Verify URL: ${verifyUrl}`);

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
          <meta name="description" content="Reset your password for your ${domain} account. This link will expire in 15 minutes.">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%); padding: 40px 20px; text-align: center;">
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
                Click the button below to securely reset your password. This link will expire in 15 minutes.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%); color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(74, 85, 104, 0.4); transition: all 0.3s ease; border: none;">
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
                If you have any questions or need assistance, our support team is here to help. You can reach us anytime at <a href="mailto:support@${domain}" style="color: #4a5568; text-decoration: underline;">support@${domain}</a>.
              </p>
              
              <p style="font-size: 16px; margin: 0; color: #555;">
                Stay secure!<br>
                <strong>The ${domain} team</strong>
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

This link will expire in 15 minutes for security reasons.

SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

If you have any questions or need assistance, our support team is here to help. You can reach us anytime at support@${domain}.

Stay secure!
The ${domain} team

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
}

/**
 * Create an email service instance from environment variables
 */
export function createEmailService(env: any): EmailService {
  const apiKey = env.BREVO_API_KEY;
  return new EmailService(apiKey);
} 