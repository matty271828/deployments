#!/usr/bin/env node

/**
 * OAuth Provider Configuration Script for GitHub Actions
 * 
 * This script configures OAuth providers for auth-service domains during deployment.
 * It checks for repository secrets with the naming convention:
 * {PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID and {PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET
 * 
 * Example: LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID, LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET
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
    1,
    ${now},
    ${now}
);
`;
}

// Check if OAuth credentials exist for a provider
function checkOAuthCredentials(project, provider) {
  const clientIdKey = `${project.toUpperCase()}_${provider.toUpperCase()}_OAUTH_CLIENT_ID`;
  const clientSecretKey = `${project.toUpperCase()}_${provider.toUpperCase()}_OAUTH_CLIENT_SECRET`;
  
  const clientId = process.env[clientIdKey];
  const clientSecret = process.env[clientSecretKey];
  
  return {
    exists: !!(clientId && clientSecret),
    clientId,
    clientSecret,
    clientIdKey,
    clientSecretKey
  };
}

// Get default scopes for a provider
function getDefaultScopes(provider) {
  switch (provider) {
    case 'google':
      return 'openid email profile';
    case 'github':
      return 'read:user user:email';
    default:
      return 'openid email profile';
  }
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
  
  // Supported OAuth providers
  const supportedProviders = ['google', 'github'];
  const configuredProviders = [];
  
  // Check each provider for credentials
  for (const provider of supportedProviders) {
    console.log(`\n🔍 Checking ${provider} OAuth credentials...`);
    
    const credentials = checkOAuthCredentials(project, provider);
    
    if (!credentials.exists) {
      console.log(`⚠️  Skipping ${provider} - credentials not found`);
      console.log(`   Expected secrets: ${credentials.clientIdKey}, ${credentials.clientSecretKey}`);
      continue;
    }
    
    console.log(`✅ Found ${provider} OAuth credentials`);
    
    // Build configuration
    const config = {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: `https://${domain}/auth/oauth/${provider}/callback`,
      scopes: getDefaultScopes(provider)
    };
    
    try {
      console.log(`🔧 Configuring ${provider}...`);
      
      // Generate SQL
      const sql = generateOAuthProviderSQL(domain, provider, config);
      
      // Execute SQL
      executeSQL(sql, authDbId, cloudflareAccountId, cloudflareApiToken);
      
      console.log(`✅ ${provider} configured successfully`);
      configuredProviders.push(provider);
      
    } catch (error) {
      console.error(`❌ Failed to configure ${provider}:`, error.message);
    }
  }
  
  if (configuredProviders.length === 0) {
    console.log('\nℹ️  No OAuth providers were configured.');
    console.log('   To enable OAuth, add repository secrets with the naming convention:');
    console.log('   {PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID and {PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET');
    console.log('   Example: LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID, LEETREPEAT_GOOGLE_OAUTH_CLIENT_SECRET');
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

module.exports = { configureOAuthProviders, generateOAuthProviderSQL, checkOAuthCredentials }; 