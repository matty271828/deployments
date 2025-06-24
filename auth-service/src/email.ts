import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

// Email service for sending emails via AWS SES
export class EmailService {
  private sesClient: SESClient;
  private awsRegion: string;
  private awsAccessKeyId: string;
  private awsSecretAccessKey: string;

  constructor(awsRegion: string, awsAccessKeyId: string, awsSecretAccessKey: string) {
    console.log(`[EMAIL SERVICE] Initializing EmailService | Region: ${awsRegion} | AccessKey: ${awsAccessKeyId.substring(0, 8)}...`);
    
    this.awsRegion = awsRegion;
    this.awsAccessKeyId = awsAccessKeyId;
    this.awsSecretAccessKey = awsSecretAccessKey;
    
    this.sesClient = new SESClient({
      region: this.awsRegion,
      credentials: {
        accessKeyId: this.awsAccessKeyId,
        secretAccessKey: this.awsSecretAccessKey,
      },
    });
    
    console.log(`[EMAIL SERVICE] EmailService initialized successfully | Region: ${awsRegion}`);
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
    console.log(`[EMAIL] Starting signup confirmation email | To: ${toEmail} | Domain: ${domain} | Name: ${firstName} ${lastName}`);
    
    try {
      const subject = `Welcome to ${domain}!`;
      console.log(`[EMAIL] Email subject: ${subject}`);
      
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

      const emailParams: SendEmailCommandInput = {
        Source: `noreply@${domain}`,
        Destination: {
          ToAddresses: [toEmail],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      };

      console.log(`[EMAIL] Email parameters prepared | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);
      console.log(`[EMAIL] Sending email via SES...`);

      const command = new SendEmailCommand(emailParams);
      const result = await this.sesClient.send(command);
      
      console.log(`[EMAIL] ✅ Signup confirmation sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.MessageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] ❌ Failed to send signup confirmation | To: ${toEmail} | Domain: ${domain} | Error: ${error.message}`);
      if (error.name) {
        console.error(`[EMAIL] Error type: ${error.name}`);
      }
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
    console.log(`[EMAIL] Starting password reset email | To: ${toEmail} | Domain: ${domain} | Name: ${firstName} ${lastName}`);
    
    try {
      const resetUrl = `https://${domain}/reset-password?token=${resetToken}`;
      const subject = `Password Reset Request - ${domain}`;
      console.log(`[EMAIL] Password reset URL: ${resetUrl}`);
      console.log(`[EMAIL] Email subject: ${subject}`);
      
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

      const emailParams: SendEmailCommandInput = {
        Source: `noreply@${domain}`,
        Destination: {
          ToAddresses: [toEmail],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      };

      console.log(`[EMAIL] Email parameters prepared | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);
      console.log(`[EMAIL] Sending password reset email via SES...`);

      const command = new SendEmailCommand(emailParams);
      const result = await this.sesClient.send(command);
      
      console.log(`[EMAIL] ✅ Password reset email sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.MessageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] ❌ Failed to send password reset email | To: ${toEmail} | Domain: ${domain} | Error: ${error.message}`);
      if (error.name) {
        console.error(`[EMAIL] Error type: ${error.name}`);
      }
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
    console.log(`[EMAIL] Starting notification email | To: ${toEmail} | Domain: ${domain} | Subject: ${subject}`);
    
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

      const emailParams: SendEmailCommandInput = {
        Source: `noreply@${domain}`,
        Destination: {
          ToAddresses: [toEmail],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: message,
              Charset: 'UTF-8',
            },
          },
        },
      };

      console.log(`[EMAIL] Email parameters prepared | From: noreply@${domain} | To: ${toEmail} | Subject: ${subject}`);
      console.log(`[EMAIL] Sending notification email via SES...`);

      const command = new SendEmailCommand(emailParams);
      const result = await this.sesClient.send(command);
      
      console.log(`[EMAIL] ✅ Notification sent successfully | To: ${toEmail} | Domain: ${domain} | MessageId: ${result.MessageId}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL] ❌ Failed to send notification | To: ${toEmail} | Domain: ${domain} | Error: ${error.message}`);
      if (error.name) {
        console.error(`[EMAIL] Error type: ${error.name}`);
      }
      throw error;
    }
  }
}

/**
 * Create an email service instance from environment variables
 */
export function createEmailService(env: any): EmailService {
  console.log(`[EMAIL SERVICE] Creating EmailService instance...`);
  
  const awsRegion = 'us-east-1'; // Hardcoded region
  
  // Try different ways to access secrets in Cloudflare Workers
  const awsAccessKeyId = env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID_SECRET || env.AWS_ACCESS_KEY_ID_SECRET_TEXT;
  const awsSecretAccessKey = env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY_SECRET || env.AWS_SECRET_ACCESS_KEY_SECRET_TEXT;

  console.log(`[EMAIL SERVICE] AWS Region: ${awsRegion}`);
  console.log(`[EMAIL SERVICE] AWS Access Key ID available: ${!!awsAccessKeyId}`);
  console.log(`[EMAIL SERVICE] AWS Secret Access Key available: ${!!awsSecretAccessKey}`);

  if (!awsAccessKeyId || !awsSecretAccessKey) {
    console.error(`[EMAIL SERVICE] ❌ AWS credentials not configured!`);
    console.error(`[EMAIL SERVICE] Access Key ID: ${awsAccessKeyId ? 'Present' : 'Missing'}`);
    console.error(`[EMAIL SERVICE] Secret Access Key: ${awsSecretAccessKey ? 'Present' : 'Missing'}`);
    console.error(`[EMAIL SERVICE] Available env keys: ${Object.keys(env).filter(key => key.includes('AWS')).join(', ')}`);
    console.error(`[EMAIL SERVICE] All env keys: ${Object.keys(env).join(', ')}`);
    throw new Error('AWS credentials not configured');
  }

  console.log(`[EMAIL SERVICE] ✅ AWS credentials found, creating EmailService...`);
  return new EmailService(awsRegion, awsAccessKeyId, awsSecretAccessKey);
} 