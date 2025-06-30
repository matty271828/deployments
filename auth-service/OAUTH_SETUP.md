# OAuth Single Sign-On Setup Guide

This guide explains how to configure OAuth Single Sign-On (SSO) for your auth-service deployment. The system supports dynamic discovery of any OAuth provider and automatically configures them for all domains without requiring code changes.

## Overview

The auth-service supports OAuth 2.0/OpenID Connect for Single Sign-On authentication. The system dynamically discovers and configures OAuth providers based on environment variables, making it easy to add new providers without code changes.

### Multi-Domain Support

The system automatically discovers **all domains** from your R2 storage and configures OAuth providers for each domain. This means:

- **No manual domain configuration** - domains are automatically discovered
- **Consistent OAuth setup** - all domains get the same OAuth providers
- **Scalable** - adding new domains automatically includes OAuth support
- **Centralized management** - OAuth configuration is managed once for all domains

### Supported Providers

The system can work with **any OAuth provider** that follows OAuth 2.0 standards. Common providers include:

- **Google** - Google OAuth 2.0
- **GitHub** - GitHub OAuth App
- **Microsoft** - Microsoft Identity Platform
- **Facebook** - Facebook Login
- **LinkedIn** - LinkedIn OAuth 2.0
- **Twitter/X** - Twitter OAuth 2.0
- **Discord** - Discord OAuth 2.0
- **Slack** - Slack OAuth
- **GitLab** - GitLab OAuth
- **Bitbucket** - Bitbucket OAuth
- **Custom** - Any OAuth 2.0 compliant provider

## Dynamic Provider Discovery

The system automatically discovers OAuth providers by scanning environment variables with a specific naming convention:

### Environment Variable Naming Convention

```
{PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID
{PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET
```

**Examples:**
- `LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID` (for domain `leetrepeat.com`)
- `LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET` (for domain `leetrepeat.com`)
- `MYAPP_GITHUB_OAUTH_CLIENT_ID` (for domain `myapp.com`)
- `MYAPP_GITHUB_OAUTH_CLIENT_SECRET` (for domain `myapp.com`)

**Note:** The system automatically extracts the project name from the domain (e.g., `leetrepeat` from `leetrepeat.com`) to find the corresponding OAuth secrets.

### Optional Configuration

You can also set optional environment variables for each provider:

```
{PROJECT}_{PROVIDER}_OAUTH_SCOPES     # Custom scopes (optional)
{PROJECT}_{PROVIDER}_OAUTH_ENABLED    # Set to "false" to disable (optional)
```

**Examples:**
- `LEETREPEAT_GOOGLE_OAUTH_SCOPES=openid email profile https://www.googleapis.com/auth/calendar`
- `LEETREPEAT_GITHUB_OAUTH_ENABLED=false`

## Setup Instructions

### 1. Create OAuth Applications

For each provider you want to support, create an OAuth application in their developer console:

#### Google OAuth 2.0
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URI: `https://yourdomain.com/auth/oauth/google/callback`
7. Copy the Client ID and Client Secret

#### GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Application name and Homepage URL
4. Set Authorization callback URL: `https://yourdomain.com/auth/oauth/github/callback`
5. Copy the Client ID and Client Secret

#### Other Providers
Follow similar steps for other providers, ensuring the redirect URI follows the pattern:
`https://yourdomain.com/auth/oauth/{provider}/callback`

**Note:** If you have multiple domains, you'll need to add the redirect URI for each domain to your OAuth app configuration. For example:
- `https://leetrepeat.com/auth/oauth/google/callback`
- `https://myapp.com/auth/oauth/google/callback`
- `https://anotherdomain.com/auth/oauth/google/callback`

### 2. Add Repository Secrets

Add the OAuth credentials as GitHub repository secrets:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following secrets (replace `YOURPROJECT` with your project name):

**Required secrets:**
```
YOURPROJECT_GOOGLE_OAUTH_CLIENT_ID
YOURPROJECT_GOOGLE_OAUTH_CLIENT_SECRET
YOURPROJECT_GITHUB_OAUTH_CLIENT_ID
YOURPROJECT_GITHUB_OAUTH_CLIENT_SECRET
```

**Optional secrets:**
```
YOURPROJECT_GOOGLE_OAUTH_SCOPES
YOURPROJECT_GITHUB_OAUTH_SCOPES
YOURPROJECT_GOOGLE_OAUTH_ENABLED
YOURPROJECT_GITHUB_OAUTH_ENABLED
```

**Example:** For domain `leetrepeat.com`, use `LEETREPEAT_` as the prefix:
```
LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID
LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET
LEETREPEAT_GITHUB_OAUTH_CLIENT_ID
LEETREPEAT_GITHUB_OAUTH_CLIENT_SECRET
```

### 3. Deploy

The OAuth providers will be automatically configured during deployment. The system will:

1. **Discover all domains** from your R2 storage
2. **Scan all environment variables** for OAuth-related secrets
3. **Discover available providers** based on the naming convention
4. **Configure each domain** with the discovered OAuth providers
5. **Validate the configuration** for each provider and domain
6. **Enable the OAuth endpoints** for all domains

### 4. Verify Configuration

After deployment, you can verify the OAuth configuration by:

1. Checking the deployment logs for OAuth configuration messages
2. Testing the OAuth authorization URL for each domain: `https://yourdomain.com/auth/oauth/authorize?provider=google`
3. Using the API to list configured providers: `GET /auth/oauth/providers`

## API Endpoints

Once configured, the following OAuth endpoints become available for **all domains**:

### OAuth Authorization
```
GET /auth/oauth/authorize?provider={provider}&redirect_uri={redirect_uri}
```
Initiates OAuth flow for the specified provider.

### OAuth Callback
```
GET /auth/oauth/{provider}/callback?code={code}&state={state}
```
Handles OAuth callback from the provider.

### List OAuth Providers
```
GET /auth/oauth/providers
```
Returns list of configured OAuth providers.

### Link OAuth Account
```
POST /auth/oauth/link
{
  "provider": "google",
  "access_token": "token_from_provider"
}
```
Links an OAuth account to an existing user account.

### Unlink OAuth Account
```
DELETE /auth/oauth/unlink
{
  "provider": "google"
}
```
Unlinks an OAuth account from a user account.

## Security Considerations

### 1. State Parameter
The system automatically generates and validates state parameters to prevent CSRF attacks.

### 2. PKCE Support
For public clients, the system supports PKCE (Proof Key for Code Exchange) for enhanced security.

### 3. Token Validation
All OAuth tokens are validated against the provider before being accepted.

### 4. Scope Validation
The system validates requested scopes against allowed scopes for each provider.

### 5. Rate Limiting
OAuth endpoints are subject to the same rate limiting as other authentication endpoints.

### 6. Domain Isolation
Each domain has its own OAuth configuration and user accounts, ensuring complete isolation.

## Troubleshooting

### Provider Not Discovered
- Check that the environment variable names follow the exact convention
- Ensure both CLIENT_ID and CLIENT_SECRET are set
- Verify the project name in the variable name matches the domain prefix (e.g., `leetrepeat` for `leetrepeat.com`)
- The system extracts the project name from the domain automatically (e.g., `leetrepeat.com` → `LEETREPEAT_` prefix)

### OAuth Flow Fails
- Verify the redirect URI in your OAuth app matches exactly
- Check that the provider is enabled in the database
- Review the deployment logs for configuration errors
- Ensure the redirect URI is added for all your domains

### Invalid Credentials
- Ensure the client ID and secret are correct
- Check that the OAuth app is properly configured
- Verify the app is approved and active

### Custom Scopes Not Working
- Ensure the scopes are valid for the provider
- Check that your OAuth app has permission for the requested scopes
- Verify the scopes are properly formatted

### Multi-Domain Issues
- Ensure all domains are properly registered in R2
- Check that OAuth apps have redirect URIs for all domains
- Verify that the same OAuth credentials work across all domains

## Advanced Configuration

### Custom Provider Configuration
For providers not in the default list, you can specify custom scopes:

```
YOURPROJECT_CUSTOM_OAUTH_SCOPES=openid email profile custom_scope
```

### Disabling Providers
To disable a provider without removing the secrets:

```
YOURPROJECT_GOOGLE_OAUTH_ENABLED=false
```

### Multiple Redirect URIs
The system automatically generates redirect URIs based on your domains. If you need multiple domains, you'll need to configure them in your OAuth app settings.

## Monitoring and Logs

OAuth-related activities are logged and can be monitored through:

1. **Deployment logs** - OAuth configuration status for all domains
2. **Application logs** - OAuth flow events and errors
3. **Database queries** - OAuth provider and account data per domain

## Support

For issues with OAuth configuration:

1. Check the deployment logs for error messages
2. Verify your OAuth app configuration
3. Test the OAuth flow manually for each domain
4. Review the security considerations above

The system is designed to be self-healing and will automatically retry failed configurations on subsequent deployments. 