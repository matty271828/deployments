# OAuth SSO Setup Guide

This guide explains how to configure OAuth Single Sign-On (SSO) for your auth-service deployment using repository secrets.

## Overview

The auth-service includes comprehensive OAuth 2.0/OpenID Connect support that is automatically configured during deployment. OAuth providers are configured using GitHub repository secrets with a specific naming convention.

## Supported Providers

- **Google OAuth 2.0** - Most common for consumer applications
- **GitHub OAuth** - Popular for developer tools and open source projects

## Setup Process

### 1. Create OAuth Applications

First, create OAuth applications with your chosen providers:

#### Google OAuth 2.0 Setup

**Important:** Google OAuth setup requires careful attention to IAM permissions and support email configuration. Follow these steps precisely.

##### Step 1: Create or Access Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID (you'll need this for IAM setup)

##### Step 2: Set Up Support Email (Critical Step)
Google requires a support email for the OAuth consent screen. This email must be associated with an active Google account or Google Workspace account.

**Option A: Create a New Google Account for Support Email**
1. Go to [accounts.google.com](https://accounts.google.com) and create a new account
2. Use your desired support email (e.g., `support@yourdomain.com`)
3. Complete the account verification process
4. **Important:** This account must be active and accessible

**Option B: Use Existing Google Workspace Account**
If you have Google Workspace, use an admin email from your workspace.

##### Step 3: Add Support Email to IAM (Required)
1. In Google Cloud Console, go to "IAM & Admin" → "IAM"
2. Click "Add" → "Add another principal"
3. Enter your support email address
4. Assign the **"Owner"** role (or at minimum "Editor" role)
5. Click "Save"
6. **Wait 5-10 minutes** for IAM changes to propagate

**Why Owner Role?** Google requires the support email to have sufficient permissions to manage the OAuth consent screen. The Owner role ensures full access.

##### Step 4: Log In with Support Email
1. Sign out of Google Cloud Console
2. Sign in using your support email account
3. Verify you can access the project and see it in the project selector

##### Step 5: Configure OAuth Consent Screen
1. In Google Cloud Console, go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type (unless you have Google Workspace)
3. Fill in the required information:
   - **App name**: Your application name
   - **User support email**: Select your support email from the dropdown
   - **Developer contact information**: Your support email
4. Add scopes (typically `email` and `profile`)
5. Add test users if needed
6. Click "Save and Continue" through all sections

**Troubleshooting Support Email Dropdown:**
- If your support email doesn't appear in the dropdown, wait 10-15 minutes for IAM propagation
- Ensure you're logged in with the correct account
- Verify the email has Owner/Editor role in IAM
- Try refreshing the page

##### Step 6: Enable Required APIs
1. Go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - Google+ API (or Google Identity API)
   - Google OAuth2 API

##### Step 7: Create OAuth 2.0 Client
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Name: Your application name
5. **Authorized redirect URIs**: `https://yourdomain.com/auth/oauth/google/callback`
6. **Authorized JavaScript origins**: Can be left empty for server-side OAuth
7. Click "Create"
8. Note down the Client ID and Client Secret

**Important Notes:**
- Only the redirect URI is required for server-side OAuth flows
- JavaScript origins are only needed for client-side OAuth
- Keep your Client Secret secure - it will only be shown once

#### GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Application name: Your app name
4. Homepage URL: `https://yourdomain.com`
5. Authorization callback URL: `https://yourdomain.com/auth/oauth/github/callback`
6. Note down the Client ID and Client Secret

### 2. Configure Repository Secrets

Add your OAuth credentials as GitHub repository secrets:

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click on the "Secrets" tab
4. Add secrets using the naming convention: `{PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID` and `{PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET`

#### Example Configuration

For a project with domain `leetrepeat.com`, add these secrets:

```
LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-your-secret-here
LEETREPEAT_GITHUB_OAUTH_CLIENT_ID=1234567890abcdef1234
LEETREPEAT_GITHUB_OAUTH_CLIENT_SECRET=abcdef1234567890your-secret-here
```

#### Naming Convention

- **Project Name**: Extracted from your domain (e.g., "leetrepeat" from "leetrepeat.com")
- **Provider**: "GOOGLE" or "GITHUB" (uppercase)
- **Suffix**: "_OAUTH_CLIENT_ID" or "_OAUTH_CLIENT_SECRET"

Examples:
- `MYAPP_GOOGLE_OAUTH_CLIENT_ID`
- `MYAPP_GOOGLE_OAUTH_CLIENT_SECRET`
- `MYAPP_GITHUB_OAUTH_CLIENT_ID`
- `MYAPP_GITHUB_OAUTH_CLIENT_SECRET`

### 3. Deploy with OAuth Configuration

When you run the deployment workflow:

1. The workflow automatically checks for OAuth credentials as environment variables
2. Providers with missing credentials are skipped with a log message
3. Configured providers are set up in the database
4. OAuth endpoints become available immediately after deployment

**Note:** Repository secrets are automatically available as environment variables during deployment, so no additional configuration is needed.

### 4. Test OAuth Integration

After deployment, test your OAuth flows:

```bash
# Test Google OAuth (if configured)
curl "https://yourdomain.com/auth/oauth/authorize?provider=google"

# Test GitHub OAuth (if configured)
curl "https://yourdomain.com/auth/oauth/authorize?provider=github"
```

## Common Challenges and Solutions

### Google OAuth Consent Screen Issues

**Problem:** Support email not appearing in dropdown
- **Solution:** Ensure the email has Owner/Editor role in IAM and wait 10-15 minutes for propagation
- **Alternative:** Use a Gmail address temporarily, then change it later

**Problem:** "Email not associated with active account" error
- **Solution:** Create a Google account for your support email and verify it's active
- **Alternative:** Use an existing Google Workspace admin email

**Problem:** Cannot access OAuth consent screen
- **Solution:** Log in with the support email account that has IAM permissions

### IAM Permission Issues

**Problem:** Support email cannot be added to IAM
- **Solution:** Ensure you're using the project owner account to add IAM members

**Problem:** IAM changes not taking effect
- **Solution:** Wait 5-10 minutes for propagation, then refresh the page

### OAuth Client Creation Issues

**Problem:** Redirect URI validation errors
- **Solution:** Ensure the URI exactly matches your domain and callback path

**Problem:** Client Secret not shown after creation
- **Solution:** You'll need to regenerate the client secret - this is normal Google security

## Security Considerations

- **Repository Secrets**: OAuth credentials are stored securely as GitHub secrets
- **Automatic Configuration**: No manual database setup required
- **Graceful Degradation**: Missing credentials don't break deployment
- **HTTPS Only**: All redirect URIs use HTTPS
- **State Tokens**: All OAuth flows use state tokens to prevent CSRF attacks

## Deployment Logs

During deployment, you'll see logs like:

```
🔗 Configuring OAuth providers for domain: leetrepeat.com (project: leetrepeat)

🔍 Checking google OAuth credentials...
✅ Found google OAuth credentials
🔧 Configuring google...
✅ google configured successfully

🔍 Checking github OAuth credentials...
⚠️  Skipping github - credentials not found
   Expected secrets: LEETREPEAT_GITHUB_OAUTH_CLIENT_ID, LEETREPEAT_GITHUB_OAUTH_CLIENT_SECRET

🎉 OAuth provider configuration complete!
Configured providers: google
```

## Troubleshooting

### Missing Credentials
If a provider is skipped, check that you've added the correct repository secrets:
- Verify the project name matches your domain
- Ensure both CLIENT_ID and CLIENT_SECRET are set
- Check that the secret names are in uppercase

### Invalid Credentials
If OAuth authentication fails:
- Verify your OAuth app configuration
- Check that redirect URIs match exactly
- Ensure the OAuth app is properly configured with the provider

### Provider-Specific Issues
- **Google:** Ensure Google+ API is enabled and support email is properly configured
- **GitHub:** Check OAuth app permissions

## API Reference

Once configured, OAuth providers are available via these endpoints:

- `GET /auth/oauth/authorize?provider={provider}` - Start OAuth flow
- `GET /auth/oauth/{provider}/callback` - Handle OAuth callback
- `POST /auth/oauth/link` - Link OAuth account to existing user
- `POST /auth/oauth/unlink` - Unlink OAuth account
- `GET /auth/oauth/accounts` - Get user's linked OAuth accounts

See the main README.md for detailed API documentation. 

## Provider Setup

### Google OAuth Setup

1. **Create Google OAuth 2.0 Client:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Authorized redirect URIs: `https://yourdomain.com/auth/oauth/google/callback`

2. **Get Credentials:**
   - Client ID: `123456789-abcdef.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-your-secret-here`

### GitHub OAuth Setup

1. **Create GitHub OAuth App:**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Application name: Your app name
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://yourdomain.com/auth/oauth/github/callback`

2. **Get Credentials:**
   - Client ID: `1234567890abcdef1234`
   - Client Secret: `abcdef1234567890...` 