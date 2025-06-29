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

#### Google OAuth 2.0
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Application type: "Web application"
6. Authorized redirect URIs: `https://yourdomain.com/auth/oauth/google/callback`
7. Note down the Client ID and Client Secret

#### GitHub OAuth
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
- **Google:** Ensure Google+ API is enabled
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