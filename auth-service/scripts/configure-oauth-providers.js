#!/usr/bin/env node

/**
 * Dynamic OAuth Provider Configuration Script for GitHub Actions
 * 
 * This script dynamically discovers and configures OAuth providers for auth-service domains.
 * It scans all environment variables for OAuth credentials using the naming convention:
 * {PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID and {PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET
 * 
 * Example: LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID, LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET
 * 
 * Additional optional variables:
 * {PROJECT}_{PROVIDER}_OAUTH_SCOPES - Custom scopes for the provider
 * {PROJECT}_{PROVIDER}_OAUTH_ENABLED - Set to "false" to disable a provider
 */

const { execSync } = require('child_process');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++; // Skip the value in next iteration
      } else {
        parsed[key] = true;
      }
    }
  }
  
  return parsed;
}

// Execute SQL command using wrangler
function executeSQL(sql, authDbId, cloudflareAccountId, cloudflareApiToken) {
  try {
    // Set environment variables for wrangler
    process.env.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
    process.env.CLOUDFLARE_API_TOKEN = cloudflareApiToken;
    
    // Escape quotes in SQL for shell command
    const escapedSql = sql.replace(/"/g, '\\"');
    
    const command = `wrangler d1 execute ${authDbId} --command "${escapedSql}"`;
    console.log(`Executing SQL command...`);
    
    const result = execSync(command, { 
      encoding: 'utf8',
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
        CLOUDFLARE_API_TOKEN: cloudflareApiToken
      }
    });
    
    console.log('✅ SQL executed successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to execute SQL:', error.message);
    throw error;
  }
}

// Generate SQL for OAuth provider configuration
function generateOAuthProviderSQL(domain, provider, config) {
  const now = Math.floor(Date.now() / 1000);
  const providerId = `${provider}_${domain}_${now}`;
  
  return `
-- OAuth Provider Configuration for ${domain}
-- Provider: ${provider}
-- Generated: ${new Date().toISOString()}

INSERT OR REPLACE INTO ${domain}_oauth_providers (
    id, 
    provider, 
    client_id, 
    client_secret, 
    redirect_uri, 
    scopes, 
    enabled, 
    created_at, 
    updated_at
) VALUES (
    '${providerId}',
    '${provider}',
    '${config.clientId}',
    '${config.clientSecret}',
    '${config.redirectUri}',
    '${config.scopes}',
    ${config.enabled ? 1 : 0},
    ${now},
    ${now}
);
`;
}

// Discover all available OAuth providers from environment variables
function discoverOAuthProviders(project) {
  const projectPrefix = `${project.toUpperCase()}_`;
  const oauthProviders = new Map();
  
  // Scan all environment variables for OAuth-related secrets
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(projectPrefix) || !key.includes('_OAUTH_')) {
      continue;
    }
    
    // Parse the key: PROJECT_PROVIDER_OAUTH_TYPE
    const parts = key.replace(projectPrefix, '').split('_');
    if (parts.length < 3) continue;
    
    const provider = parts[0].toLowerCase();
    const type = parts.slice(2).join('_').toLowerCase(); // OAUTH_CLIENT_ID -> client_id
    
    if (!oauthProviders.has(provider)) {
      oauthProviders.set(provider, {
        provider,
        clientId: null,
        clientSecret: null,
        scopes: null,
        enabled: true
      });
    }
    
    const providerConfig = oauthProviders.get(provider);
    
    switch (type) {
      case 'client_id':
        providerConfig.clientId = value;
        break;
      case 'client_secret':
        providerConfig.clientSecret = value;
        break;
      case 'scopes':
        providerConfig.scopes = value;
        break;
      case 'enabled':
        providerConfig.enabled = value.toLowerCase() !== 'false';
        break;
    }
  }
  
  // Filter to only include providers with both client ID and secret
  const validProviders = [];
  for (const [provider, config] of oauthProviders) {
    if (config.clientId && config.clientSecret) {
      validProviders.push(config);
    }
  }
  
  return validProviders;
}

// Get default scopes for a provider
function getDefaultScopes(provider) {
  const providerLower = provider.toLowerCase();
  
  switch (providerLower) {
    case 'google':
      return 'openid email profile';
    case 'github':
      return 'read:user user:email';
    case 'microsoft':
    case 'azure':
      return 'openid email profile';
    case 'facebook':
      return 'email public_profile';
    case 'linkedin':
      return 'r_liteprofile r_emailaddress';
    case 'twitter':
    case 'x':
      return 'tweet.read users.read';
    case 'discord':
      return 'identify email';
    case 'slack':
      return 'identity.basic identity.email';
    case 'gitlab':
      return 'read_user';
    case 'bitbucket':
      return 'account';
    default:
      // For unknown providers, use a safe default
      return 'openid email profile';
  }
}

// Validate OAuth provider configuration
function validateProviderConfig(provider, config) {
  const errors = [];
  
  if (!config.clientId) {
    errors.push('Missing client ID');
  }
  
  if (!config.clientSecret) {
    errors.push('Missing client secret');
  }
  
  if (config.clientId && config.clientId.length < 10) {
    errors.push('Client ID appears to be too short');
  }
  
  if (config.clientSecret && config.clientSecret.length < 10) {
    errors.push('Client secret appears to be too short');
  }
  
  if (errors.length > 0) {
    console.warn(`⚠️  Validation warnings for ${provider}: ${errors.join(', ')}`);
  }
  
  return errors.length === 0;
}

// Main configuration function
async function configureOAuthProviders() {
  const args = parseArgs();
  
  // Validate required arguments
  if (!args.domain) {
    console.error('❌ --domain is required');
    process.exit(1);
  }
  
  if (!args['auth-db-id']) {
    console.error('❌ --auth-db-id is required');
    process.exit(1);
  }
  
  if (!args['cloudflare-account-id']) {
    console.error('❌ --cloudflare-account-id is required');
    process.exit(1);
  }
  
  if (!args['cloudflare-api-token']) {
    console.error('❌ --cloudflare-api-token is required');
    process.exit(1);
  }
  
  const domain = args.domain;
  const authDbId = args['auth-db-id'];
  const cloudflareAccountId = args['cloudflare-account-id'];
  const cloudflareApiToken = args['cloudflare-api-token'];
  
  // Extract project name from domain (e.g., "leetrepeat" from "leetrepeat.com")
  const project = domain.split('.')[0];
  
  console.log(`🔗 Configuring OAuth providers for domain: ${domain} (project: ${project})`);
  
  // Discover all available OAuth providers
  console.log('\n🔍 Scanning environment variables for OAuth providers...');
  const discoveredProviders = discoverOAuthProviders(project);
  
  if (discoveredProviders.length === 0) {
    console.log('\nℹ️  No OAuth providers found.');
    console.log('   To enable OAuth, add repository secrets with the naming convention:');
    console.log('   {PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID and {PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET');
    console.log('   Example: LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID, LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET');
    console.log('\n   Optional: {PROJECT}_{PROVIDER}_OAUTH_SCOPES for custom scopes');
    console.log('   Optional: {PROJECT}_{PROVIDER}_OAUTH_ENABLED=false to disable a provider');
    return;
  }
  
  console.log(`✅ Found ${discoveredProviders.length} OAuth provider(s): ${discoveredProviders.map(p => p.provider).join(', ')}`);
  
  const configuredProviders = [];
  const failedProviders = [];
  
  // Configure each discovered provider
  for (const providerConfig of discoveredProviders) {
    const { provider, clientId, clientSecret, scopes, enabled } = providerConfig;
    
    console.log(`\n🔍 Processing ${provider} OAuth provider...`);
    
    // Validate configuration
    if (!validateProviderConfig(provider, providerConfig)) {
      console.log(`⚠️  Skipping ${provider} due to validation issues`);
      failedProviders.push(provider);
      continue;
    }
    
    if (!enabled) {
      console.log(`⚠️  Skipping ${provider} - provider is disabled`);
      continue;
    }
    
    console.log(`✅ ${provider} configuration is valid`);
    
    // Build configuration
    const config = {
      clientId,
      clientSecret,
      redirectUri: `https://${domain}/auth/oauth/${provider}/callback`,
      scopes: scopes || getDefaultScopes(provider),
      enabled
    };
    
    try {
      console.log(`🔧 Configuring ${provider}...`);
      console.log(`   Redirect URI: ${config.redirectUri}`);
      console.log(`   Scopes: ${config.scopes}`);
      
      // Generate SQL
      const sql = generateOAuthProviderSQL(domain, provider, config);
      
      // Execute SQL
      executeSQL(sql, authDbId, cloudflareAccountId, cloudflareApiToken);
      
      console.log(`✅ ${provider} configured successfully`);
      configuredProviders.push(provider);
      
    } catch (error) {
      console.error(`❌ Failed to configure ${provider}:`, error.message);
      failedProviders.push(provider);
    }
  }
  
  // Summary
  console.log('\n📊 Configuration Summary:');
  console.log(`✅ Successfully configured: ${configuredProviders.length} provider(s)`);
  if (configuredProviders.length > 0) {
    console.log(`   - ${configuredProviders.join(', ')}`);
  }
  
  if (failedProviders.length > 0) {
    console.log(`❌ Failed to configure: ${failedProviders.length} provider(s)`);
    console.log(`   - ${failedProviders.join(', ')}`);
  }
  
  if (configuredProviders.length === 0) {
    console.log('\nℹ️  No OAuth providers were successfully configured.');
    return;
  }
  
  // Verify configuration
  console.log('\n🔍 Verifying OAuth provider configuration...');
  try {
    const verifySql = `
SELECT 
    provider, 
    client_id, 
    redirect_uri, 
    scopes, 
    enabled,
    datetime(created_at, 'unixepoch') as created_at
FROM ${domain}_oauth_providers 
WHERE enabled = 1
ORDER BY provider;
`;
    
    const result = executeSQL(verifySql, authDbId, cloudflareAccountId, cloudflareApiToken);
    console.log('📊 Current OAuth provider configuration:');
    console.log(result);
    
  } catch (error) {
    console.error('❌ Failed to verify configuration:', error.message);
  }
  
  console.log('\n🎉 OAuth provider configuration complete!');
  console.log(`\nConfigured providers: ${configuredProviders.join(', ')}`);
  console.log(`\nTest your OAuth flows by visiting:`);
  configuredProviders.forEach(provider => {
    console.log(`- https://${domain}/auth/oauth/authorize?provider=${provider}`);
  });
}

// Handle script execution
if (require.main === module) {
  configureOAuthProviders().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { 
  configureOAuthProviders, 
  generateOAuthProviderSQL, 
  discoverOAuthProviders,
  validateProviderConfig,
  getDefaultScopes
}; 