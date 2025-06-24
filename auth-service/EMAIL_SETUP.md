# Email Setup for Auth Service

This document explains how to set up and use the email functionality in the auth-service.

## Overview

The auth-service now includes email functionality powered by AWS SES (Simple Email Service). It can send:
- Signup confirmation emails
- Password reset emails
- Generic notification emails

## Prerequisites

1. **AWS SES Configuration**: Your domains must be verified in AWS SES
2. **AWS Credentials**: Access key and secret key with SES permissions
3. **Domain Verification**: Each domain must be verified in SES before sending emails

## Setup Steps

### 1. Install Dependencies

```bash
cd auth-service
npm install
```

### 2. Configure AWS Credentials

AWS credentials are automatically configured during the deployment process via GitHub Actions. The deployment action will:

1. Set AWS credentials as wrangler secrets
2. Deploy the worker with email functionality enabled

**For manual deployment (development/testing):**

```bash
# Set AWS access key
wrangler secret put AWS_ACCESS_KEY_ID

# Set AWS secret key  
wrangler secret put AWS_SECRET_ACCESS_KEY
```

### 3. Verify Domains in AWS SES

Each domain you want to send emails from must be verified in AWS SES:

1. Go to AWS SES Console
2. Navigate to "Verified identities"
3. Click "Create identity"
4. Select "Domain" and enter your domain (e.g., `example.com`)
5. Follow the verification steps (add DNS records)
6. Wait for verification to complete

### 4. Deploy the Service

The service is automatically deployed via GitHub Actions when changes are pushed to the main branch.

**For manual deployment:**

```bash
# Build and deploy
npm run build
npm run deploy
```

## Email Endpoints

### 1. Signup Confirmation (Automatic)

When a user signs up via `/auth/signup`, a confirmation email is automatically sent.

**Request:**
```json
POST /auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": { ... },
  "session": { ... },
  "emailSent": true,
  "emailError": null
}
```

### 2. Send Custom Email

Send a custom email via the email endpoint.

**Request:**
```json
POST /auth/email/send
{
  "email": "user@example.com",
  "subject": "Welcome!",
  "message": "Thank you for joining our platform."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

### 3. Password Reset Email

Send a password reset email (requires reset token generation).

**Implementation Note:** This requires additional password reset functionality to be implemented.

## Email Templates

The service includes pre-built email templates:

### Signup Confirmation Template
- **Subject**: "Welcome to {domain}!"
- **Content**: Personalized welcome message with account details
- **From**: `noreply@{domain}`

### Password Reset Template
- **Subject**: "Password Reset Request - {domain}"
- **Content**: Reset link with security information
- **From**: `noreply@{domain}`

### Generic Notification Template
- **Subject**: Custom subject
- **Content**: Custom message with domain branding
- **From**: `noreply@{domain}`

## Email Addresses

The system uses two email addresses:

- **`noreply@{domain}`**: Used for sending automated emails (signup confirmations, password resets, etc.) - **send only**
- **`support@{domain}`**: Used for receiving customer inquiries and support requests - **receive only**

Only `support@{domain}` is configured to forward incoming emails to your Gmail address for monitoring.

## Testing

Use the provided test script to verify email functionality:

```bash
# Edit test-email.js with your domain and test email
node test-email.js
```

Or test directly via curl:

```bash
# Test signup with email
curl -X POST https://yourdomain.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Test custom email
curl -X POST https://yourdomain.com/auth/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "subject": "Test Email",
    "message": "This is a test email."
  }'
```

## Error Handling

The email service includes comprehensive error handling:

- **Email failures don't block signup**: If email sending fails, the signup still succeeds
- **Detailed logging**: All email operations are logged with success/failure details
- **Rate limiting**: Email endpoints are rate-limited to prevent abuse
- **Validation**: Email addresses and content are validated before sending

## Troubleshooting

### Common Issues

1. **"AWS credentials not configured"**
   - Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set as secrets

2. **"Email address not verified"**
   - Verify the sender domain in AWS SES
   - For testing, verify individual email addresses

3. **"Sending quota exceeded"**
   - Check your AWS SES sending limits
   - Request production access if needed

4. **"Invalid email format"**
   - Ensure email addresses are properly formatted
   - Check for typos in email addresses

### Debug Information

Check the worker logs for detailed email operation information:

```bash
wrangler tail auth-service
```