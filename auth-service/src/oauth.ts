/**
 * OAuth SSO Implementation
 * 
 * Supports Google and GitHub OAuth providers with domain-specific configuration
 * and secure token handling.
 */

import { D1Database } from '@cloudflare/workers-types';
import { generateSecureRandomString } from './generator';
import { OAuthProvider, OAuthAccount, OAuthStateToken, OAuthAuthorizeRequest, OAuthCallbackRequest, OAuthLinkRequest, OAuthUnlinkRequest, OAuthResponse, User } from './types';
import { createSession, validateSessionToken } from './sessions';
import { getUserByEmail, createUser, getUserById } from './users';

// OAuth provider configurations
const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: 'openid email profile'
  },
  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    defaultScopes: 'read:user user:email'
  }
} as const;

type OAuthProviderType = keyof typeof OAUTH_PROVIDERS;

/**
 * Get OAuth provider configuration from database
 */
export async function getOAuthProvider(db: D1Database, subdomain: string, provider: string): Promise<OAuthProvider | null> {
  try {
    const result = await db.prepare(`
      SELECT id, provider, client_id, client_secret, redirect_uri, scopes, enabled, created_at, updated_at
      FROM ${subdomain}_oauth_providers 
      WHERE provider = ? AND enabled = 1
    `).bind(provider).first();

    if (!result) return null;

    return {
      id: result.id as string,
      provider: result.provider as string,
      clientId: result.client_id as string,
      clientSecret: result.client_secret as string,
      redirectUri: result.redirect_uri as string,
      scopes: result.scopes as string,
      enabled: Boolean(result.enabled),
      createdAt: new Date((result.created_at as number) * 1000),
      updatedAt: new Date((result.updated_at as number) * 1000)
    };
  } catch (error) {
    console.error(`[OAUTH] Error getting provider config for ${provider}:`, error);
    return null;
  }
}

/**
 * Create OAuth state token for flow security
 */
export async function createOAuthStateToken(db: D1Database, subdomain: string, provider: string, redirectUri: string): Promise<string> {
  const token = generateSecureRandomString();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600; // 10 minutes expiry

  try {
    await db.prepare(`
      INSERT INTO ${subdomain}_oauth_state_tokens (token, provider, redirect_uri, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(token, provider, redirectUri, now, expiresAt).run();

    return token;
  } catch (error) {
    console.error(`[OAUTH] Error creating state token for ${provider}:`, error);
    throw new Error('Failed to create OAuth state token');
  }
}

/**
 * Validate OAuth state token
 */
export async function validateOAuthStateToken(db: D1Database, subdomain: string, token: string, provider: string): Promise<{ valid: boolean; redirectUri?: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.prepare(`
      SELECT redirect_uri FROM ${subdomain}_oauth_state_tokens 
      WHERE token = ? AND provider = ? AND expires_at > ?
    `).bind(token, provider, now).first();

    if (!result) {
      return { valid: false };
    }

    // Delete the token after use (one-time use)
    await db.prepare(`
      DELETE FROM ${subdomain}_oauth_state_tokens WHERE token = ?
    `).bind(token).run();

    return {
      valid: true,
      redirectUri: result.redirect_uri as string
    };
  } catch (error) {
    console.error(`[OAUTH] Error validating state token for ${provider}:`, error);
    return { valid: false };
  }
}

/**
 * Get OAuth account by provider user ID
 */
export async function getOAuthAccountByProviderId(db: D1Database, subdomain: string, provider: string, providerUserId: string): Promise<OAuthAccount | null> {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, provider, provider_user_id, provider_user_email, access_token, refresh_token, token_expires_at, created_at, updated_at
      FROM ${subdomain}_oauth_accounts 
      WHERE provider = ? AND provider_user_id = ?
    `).bind(provider, providerUserId).first();

    if (!result) return null;

    return {
      id: result.id as string,
      userId: result.user_id as string,
      provider: result.provider as string,
      providerUserId: result.provider_user_id as string,
      providerUserEmail: result.provider_user_email as string,
      accessToken: result.access_token as string,
      refreshToken: result.refresh_token as string,
      tokenExpiresAt: result.token_expires_at ? new Date((result.token_expires_at as number) * 1000) : undefined,
      createdAt: new Date((result.created_at as number) * 1000),
      updatedAt: new Date((result.updated_at as number) * 1000)
    };
  } catch (error) {
    console.error(`[OAUTH] Error getting OAuth account for ${provider}:`, error);
    return null;
  }
}

/**
 * Create OAuth account
 */
export async function createOAuthAccount(db: D1Database, subdomain: string, userId: string, provider: string, providerUserId: string, providerUserEmail?: string, accessToken?: string, refreshToken?: string): Promise<OAuthAccount> {
  const id = generateSecureRandomString();
  const now = Math.floor(Date.now() / 1000);
  const tokenExpiresAt = accessToken ? now + 3600 : undefined; // 1 hour default

  try {
    await db.prepare(`
      INSERT INTO ${subdomain}_oauth_accounts (id, user_id, provider, provider_user_id, provider_user_email, access_token, refresh_token, token_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, userId, provider, providerUserId, providerUserEmail, accessToken, refreshToken, tokenExpiresAt, now, now).run();

    return {
      id,
      userId,
      provider,
      providerUserId,
      providerUserEmail,
      accessToken,
      refreshToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt * 1000) : undefined,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000)
    };
  } catch (error) {
    console.error(`[OAUTH] Error creating OAuth account for ${provider}:`, error);
    throw new Error('Failed to create OAuth account');
  }
}

/**
 * Update OAuth account tokens
 */
export async function updateOAuthAccountTokens(db: D1Database, subdomain: string, accountId: string, accessToken?: string, refreshToken?: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const tokenExpiresAt = accessToken ? now + 3600 : undefined;

  try {
    await db.prepare(`
      UPDATE ${subdomain}_oauth_accounts 
      SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(accessToken, refreshToken, tokenExpiresAt, now, accountId).run();
  } catch (error) {
    console.error(`[OAUTH] Error updating OAuth account tokens:`, error);
    throw new Error('Failed to update OAuth account tokens');
  }
}

/**
 * Delete OAuth account
 */
export async function deleteOAuthAccount(db: D1Database, subdomain: string, userId: string, provider: string): Promise<boolean> {
  try {
    const result = await db.prepare(`
      DELETE FROM ${subdomain}_oauth_accounts 
      WHERE user_id = ? AND provider = ?
    `).bind(userId, provider).run();

    return result.meta.changes > 0;
  } catch (error) {
    console.error(`[OAUTH] Error deleting OAuth account for ${provider}:`, error);
    return false;
  }
}

/**
 * Get OAuth accounts for a user
 */
export async function getOAuthAccountsForUser(db: D1Database, subdomain: string, userId: string): Promise<OAuthAccount[]> {
  try {
    const results = await db.prepare(`
      SELECT id, user_id, provider, provider_user_id, provider_user_email, access_token, refresh_token, token_expires_at, created_at, updated_at
      FROM ${subdomain}_oauth_accounts 
      WHERE user_id = ?
    `).bind(userId).all();

    return results.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      provider: row.provider as string,
      providerUserId: row.provider_user_id as string,
      providerUserEmail: row.provider_user_email as string,
      accessToken: row.access_token as string,
      refreshToken: row.refresh_token as string,
      tokenExpiresAt: row.token_expires_at ? new Date((row.token_expires_at as number) * 1000) : undefined,
      createdAt: new Date((row.created_at as number) * 1000),
      updatedAt: new Date((row.updated_at as number) * 1000)
    }));
  } catch (error) {
    console.error(`[OAUTH] Error getting OAuth accounts for user:`, error);
    return [];
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(provider: OAuthProviderType, clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const providerConfig = OAUTH_PROVIDERS[provider];
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(providerConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OAUTH] Token exchange failed for ${provider}:`, errorText);
    throw new Error(`Failed to exchange authorization code for token: ${response.status}`);
  }

  const data = await response.json() as any;
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in
  };
}

/**
 * Get user information from OAuth provider
 */
async function getUserInfoFromProvider(provider: OAuthProviderType, accessToken: string): Promise<{ id: string; email: string; name: string; firstName?: string; lastName?: string }> {
  const providerConfig = OAUTH_PROVIDERS[provider];
  
  const response = await fetch(providerConfig.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get user info from ${provider}: ${response.status}`);
  }

  const data = await response.json() as any;

  // Normalize user data across different providers
  switch (provider) {
    case 'google':
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name
      };
    case 'github':
      return {
        id: data.id.toString(),
        email: data.email || '',
        name: data.name || data.login,
        firstName: data.name ? data.name.split(' ')[0] : undefined,
        lastName: data.name ? data.name.split(' ').slice(1).join(' ') : undefined
      };
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Handle OAuth callback and create/login user
 */
export async function handleOAuthCallback(db: D1Database, subdomain: string, provider: OAuthProviderType, code: string, state: string): Promise<OAuthResponse> {
  try {
    // Validate state token
    const stateValidation = await validateOAuthStateToken(db, subdomain, state, provider);
    if (!stateValidation.valid) {
      return {
        success: false,
        error: 'Invalid or expired OAuth state token'
      };
    }

    // Get provider configuration
    const providerConfig = await getOAuthProvider(db, subdomain, provider);
    if (!providerConfig) {
      return {
        success: false,
        error: 'OAuth provider not configured'
      };
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(
      provider,
      providerConfig.clientId,
      providerConfig.clientSecret,
      code,
      stateValidation.redirectUri || providerConfig.redirectUri
    );

    // Get user info from provider
    const userInfo = await getUserInfoFromProvider(provider, tokenData.accessToken);

    // Check if OAuth account already exists
    let oauthAccount = await getOAuthAccountByProviderId(db, subdomain, provider, userInfo.id);
    let user: User;

    if (oauthAccount) {
      // Update existing OAuth account tokens
      await updateOAuthAccountTokens(db, subdomain, oauthAccount.id, tokenData.accessToken, tokenData.refreshToken);
      
      // Get user
      const userResult = await getUserById(db, subdomain, oauthAccount.userId);
      if (!userResult) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      user = userResult;
    } else {
      // Check if user exists with the same email
      const existingUser = await getUserByEmail(db, subdomain, userInfo.email);
      
      if (existingUser) {
        // Link existing user to OAuth provider
        oauthAccount = await createOAuthAccount(
          db,
          subdomain,
          existingUser.id,
          provider,
          userInfo.id,
          userInfo.email,
          tokenData.accessToken,
          tokenData.refreshToken
        );
        user = existingUser;
      } else {
        // Create new user
        const firstName = userInfo.firstName || userInfo.name.split(' ')[0];
        const lastName = userInfo.lastName || userInfo.name.split(' ').slice(1).join(' ') || '';
        
        user = await createUser(
          db,
          subdomain,
          userInfo.email,
          '', // No password for OAuth users
          firstName,
          lastName
        );

        // Create OAuth account
        oauthAccount = await createOAuthAccount(
          db,
          subdomain,
          user.id,
          provider,
          userInfo.id,
          userInfo.email,
          tokenData.accessToken,
          tokenData.refreshToken
        );
      }
    }

    // Create session
    const session = await createSession(db, subdomain, user.id);

    return {
      success: true,
      message: 'OAuth authentication successful',
      user,
      session: {
        id: session.id,
        token: session.token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    };

  } catch (error) {
    console.error(`[OAUTH] Error handling callback for ${provider}:`, error);
    return {
      success: false,
      error: 'OAuth authentication failed'
    };
  }
}

/**
 * Generate OAuth authorization URL
 */
export function generateOAuthUrl(provider: OAuthProviderType, clientId: string, redirectUri: string, state: string, scopes?: string): string {
  const providerConfig = OAUTH_PROVIDERS[provider];
  const defaultScopes = providerConfig.defaultScopes;
  const requestedScopes = scopes || defaultScopes;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: requestedScopes,
    state: state
  });

  // Add provider-specific parameters
  if (provider === 'github') {
    params.append('allow_signup', 'false');
  }

  return `${providerConfig.authUrl}?${params.toString()}`;
} 