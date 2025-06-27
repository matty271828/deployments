#!/usr/bin/env node

/**
 * Stripe Setup Helper Script
 * 
 * This script helps you get your Stripe API keys and set up your account
 * for the deployment platform.
 */

console.log(`
🔧 Stripe Setup Helper
======================

This script will guide you through setting up Stripe for your deployment platform.

📋 Prerequisites:
- A Stripe account (create one at https://stripe.com)
- Access to your Stripe Dashboard

🚀 Let's get started!

`);

console.log(`
Step 1: Get Your Stripe API Keys
--------------------------------

1. Go to https://dashboard.stripe.com/apikeys
2. You'll see two keys:
   - Publishable key (starts with 'pk_')
   - Secret key (starts with 'sk_')

3. Copy your SECRET key (the one starting with 'sk_')
   ⚠️  Keep this secret and never share it publicly!

4. Add it to your GitHub repository secrets:
   - Go to your repository Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: STRIPE_SECRET_KEY
   - Value: Your secret key (sk_...)

`);

console.log(`
Step 2: Enable Webhooks (Optional - Will be done automatically)
---------------------------------------------------------------

The deployment process will automatically:
- Create a webhook endpoint for your domain
- Configure the webhook to listen for subscription events
- Set the webhook secret as an environment variable

You don't need to do anything manually for webhooks!

`);

console.log(`
Step 3: Test Your Setup
-----------------------

1. Run a deployment with your Stripe secret key
2. The system will automatically:
   - Create a "Premium Plan" product (£9.99/month)
   - Create a price for the product
   - Set up webhook endpoints
   - Configure all environment variables

3. Check your Stripe Dashboard after deployment:
   - Products: https://dashboard.stripe.com/products
   - Webhooks: https://dashboard.stripe.com/webhooks

`);

console.log(`
🎉 You're all set!

The deployment platform will handle everything else automatically.
Your users will be able to subscribe to the Premium Plan for £9.99/month.

Need help? Check the README.md for more details.
`);

// Check if running in a deployment environment
if (process.env.STRIPE_SECRET_KEY) {
  console.log(`
✅ Stripe secret key detected in environment!
The deployment process will use this key automatically.
`);
} else {
  console.log(`
⚠️  No Stripe secret key found in environment.
Make sure to add STRIPE_SECRET_KEY to your GitHub repository secrets.
`);
} 