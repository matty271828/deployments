/**
 * Subscription Management Functions
 * 
 * Handles Stripe integration, subscription status tracking, and customer management
 */

import { D1Database } from '@cloudflare/workers-types';
import { generateSecureRandomString } from './generator';
import { Subscription, StripeCustomer, CreateCheckoutSessionRequest, CreatePortalSessionRequest } from './types';

/**
 * Get user's subscription status
 */
export async function getSubscription(db: D1Database, prefix: string, userId: string): Promise<Subscription | null> {
  try {
    const result = await db.prepare(`
      SELECT * FROM ${prefix}_subscriptions 
      WHERE user_id = ?
    `).bind(userId).first() as any;

    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      userId: result.user_id as string,
      stripeSubscriptionId: result.stripe_subscription_id as string | undefined,
      status: result.status as 'free' | 'standard' | 'canceled' | 'past_due',
      planId: result.plan_id as string | undefined,
      currentPeriodEnd: result.current_period_end ? new Date((result.current_period_end as number) * 1000) : undefined,
      createdAt: new Date((result.created_at as number) * 1000),
      updatedAt: new Date((result.updated_at as number) * 1000)
    };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
}

/**
 * Create or get Stripe customer for user
 */
export async function getOrCreateStripeCustomer(
  db: D1Database, 
  prefix: string, 
  userId: string, 
  userEmail: string,
  stripe: any
): Promise<StripeCustomer> {
  try {
    // Check if customer already exists
    const existingCustomer = await db.prepare(`
      SELECT * FROM ${prefix}_stripe_customers 
      WHERE user_id = ?
    `).bind(userId).first() as any;

    if (existingCustomer) {
      return {
        id: existingCustomer.id as string,
        userId: existingCustomer.user_id as string,
        stripeCustomerId: existingCustomer.stripe_customer_id as string,
        createdAt: new Date((existingCustomer.created_at as number) * 1000),
        updatedAt: new Date((existingCustomer.updated_at as number) * 1000)
      };
    }

    // Create new Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        user_id: userId
      }
    });

    // Save to database
    const customerId = generateSecureRandomString();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO ${prefix}_stripe_customers (id, user_id, stripe_customer_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(customerId, userId, stripeCustomer.id, now, now).run();

    return {
      id: customerId,
      userId,
      stripeCustomerId: stripeCustomer.id,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000)
    };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error('Failed to create Stripe customer');
  }
}

/**
 * Create Stripe Checkout session
 */
export async function createCheckoutSession(
  db: D1Database,
  prefix: string,
  userId: string,
  userEmail: string,
  request: CreateCheckoutSessionRequest,
  stripe: any,
  domain: string
): Promise<string> {
  try {
    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(db, prefix, userId, userEmail, stripe);

    // Get price ID from request (frontend should provide this)
    const priceId = request.priceId;
    if (!priceId) {
      throw new Error('Price ID is required for checkout session');
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: {
        user_id: userId,
        domain: domain
      }
    });

    return session.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Create customer portal session
 */
export async function createPortalSession(
  db: D1Database,
  prefix: string,
  userId: string,
  request: CreatePortalSessionRequest,
  stripe: any
): Promise<string> {
  try {
    // Get user's Stripe customer
    const customer = await db.prepare(`
      SELECT stripe_customer_id FROM ${prefix}_stripe_customers 
      WHERE user_id = ?
    `).bind(userId).first() as any;

    if (!customer) {
      throw new Error('No Stripe customer found for user');
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id as string,
      return_url: request.returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw new Error('Failed to create portal session');
  }
}

/**
 * Update subscription status from Stripe webhook
 */
export async function updateSubscriptionFromWebhook(
  db: D1Database,
  prefix: string,
  stripeSubscriptionId: string,
  status: string,
  planId?: string,
  currentPeriodEnd?: number
): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Update subscription
    await db.prepare(`
      UPDATE ${prefix}_subscriptions 
      SET status = ?, plan_id = ?, current_period_end = ?, updated_at = ?
      WHERE stripe_subscription_id = ?
    `).bind(status, planId, currentPeriodEnd, now, stripeSubscriptionId).run();
  } catch (error) {
    console.error('Error updating subscription from webhook:', error);
    throw new Error('Failed to update subscription');
  }
}

/**
 * Create initial subscription record for user
 */
export async function createInitialSubscription(
  db: D1Database,
  prefix: string,
  userId: string
): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const subscriptionId = generateSecureRandomString();

    await db.prepare(`
      INSERT INTO ${prefix}_subscriptions (id, user_id, status, created_at, updated_at)
      VALUES (?, ?, 'free', ?, ?)
    `).bind(subscriptionId, userId, now, now).run();
  } catch (error) {
    console.error('Error creating initial subscription:', error);
    throw new Error('Failed to create initial subscription');
  }
}

/**
 * Check if webhook event has been processed
 */
export async function isWebhookProcessed(
  db: D1Database,
  prefix: string,
  stripeEventId: string
): Promise<boolean> {
  try {
    const result = await db.prepare(`
      SELECT processed FROM ${prefix}_webhook_events 
      WHERE stripe_event_id = ?
    `).bind(stripeEventId).first() as any;

    return result ? (result.processed as number) === 1 : false;
  } catch (error) {
    console.error('Error checking webhook status:', error);
    return false;
  }
}

/**
 * Mark webhook event as processed
 */
export async function markWebhookProcessed(
  db: D1Database,
  prefix: string,
  stripeEventId: string,
  eventType: string
): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const eventId = generateSecureRandomString();

    await db.prepare(`
      INSERT INTO ${prefix}_webhook_events (id, stripe_event_id, event_type, processed, created_at)
      VALUES (?, ?, ?, 1, ?)
    `).bind(eventId, stripeEventId, eventType, now).run();
  } catch (error) {
    console.error('Error marking webhook as processed:', error);
    throw new Error('Failed to mark webhook as processed');
  }
}

/**
 * Get user email by ID
 */
export async function getUserEmail(db: D1Database, prefix: string, userId: string): Promise<string | null> {
  try {
    const result = await db.prepare(`
      SELECT email FROM ${prefix}_users 
      WHERE id = ?
    `).bind(userId).first() as any;

    return result ? (result.email as string) : null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

/**
 * Handle checkout.session.completed webhook event
 */
export async function handleCheckoutSessionCompleted(
  db: D1Database,
  prefix: string,
  session: any,
  stripe: any
): Promise<void> {
  try {
    console.log(`[WEBHOOK] Processing checkout session completed for session ${session.id}`);
    
    const userId = session.metadata?.user_id;
    if (!userId) {
      console.error('[WEBHOOK] No user_id in session metadata');
      return;
    }

    // Get the subscription from the session
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      // Update or create subscription record
      const now = Math.floor(Date.now() / 1000);
      const subscriptionId = generateSecureRandomString();
      
      // Check if subscription already exists
      const existing = await db.prepare(`
        SELECT id FROM ${prefix}_subscriptions 
        WHERE stripe_subscription_id = ?
      `).bind(session.subscription).first() as any;

      if (existing) {
        // Update existing subscription
        await db.prepare(`
          UPDATE ${prefix}_subscriptions 
          SET status = ?, plan_id = ?, current_period_end = ?, updated_at = ?
          WHERE stripe_subscription_id = ?
        `).bind(
          subscription.status,
          subscription.items.data[0]?.price.id,
          subscription.current_period_end,
          now,
          session.subscription
        ).run();
      } else {
        // Create new subscription
        await db.prepare(`
          INSERT INTO ${prefix}_subscriptions (id, user_id, stripe_subscription_id, status, plan_id, current_period_end, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          subscriptionId,
          userId,
          session.subscription,
          subscription.status,
          subscription.items.data[0]?.price.id,
          subscription.current_period_end,
          now,
          now
        ).run();
      }

      console.log(`[WEBHOOK] ✅ Updated subscription for user ${userId} to status ${subscription.status}`);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error handling checkout session completed:', error);
    throw error;
  }
}

/**
 * Handle subscription events (created, updated, deleted)
 */
export async function handleSubscriptionEvent(
  db: D1Database,
  prefix: string,
  subscription: any
): Promise<void> {
  try {
    console.log(`[WEBHOOK] Processing subscription event for subscription ${subscription.id}`);
    
    const now = Math.floor(Date.now() / 1000);
    
    // Check if subscription exists in our database
    const existing = await db.prepare(`
      SELECT id FROM ${prefix}_subscriptions 
      WHERE stripe_subscription_id = ?
    `).bind(subscription.id).first() as any;

    if (existing) {
      // Update existing subscription
      await db.prepare(`
        UPDATE ${prefix}_subscriptions 
        SET status = ?, plan_id = ?, current_period_end = ?, updated_at = ?
        WHERE stripe_subscription_id = ?
      `).bind(
        subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.current_period_end,
        now,
        subscription.id
      ).run();
      
      console.log(`[WEBHOOK] ✅ Updated subscription ${subscription.id} to status ${subscription.status}`);
    } else {
      console.log(`[WEBHOOK] ⚠️ Subscription ${subscription.id} not found in database, skipping update`);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error handling subscription event:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
export async function handleInvoicePaymentSucceeded(
  db: D1Database,
  prefix: string,
  invoice: any
): Promise<void> {
  try {
    console.log(`[WEBHOOK] Processing invoice payment succeeded for invoice ${invoice.id}`);
    
    if (invoice.subscription) {
      // Update subscription status to active
      const now = Math.floor(Date.now() / 1000);
      
      await db.prepare(`
        UPDATE ${prefix}_subscriptions 
        SET status = 'standard', updated_at = ?
        WHERE stripe_subscription_id = ?
      `).bind(now, invoice.subscription).run();
      
      console.log(`[WEBHOOK] ✅ Updated subscription ${invoice.subscription} to standard status`);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error handling invoice payment succeeded:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(
  db: D1Database,
  prefix: string,
  invoice: any
): Promise<void> {
  try {
    console.log(`[WEBHOOK] Processing invoice payment failed for invoice ${invoice.id}`);
    
    if (invoice.subscription) {
      // Update subscription status to past_due
      const now = Math.floor(Date.now() / 1000);
      
      await db.prepare(`
        UPDATE ${prefix}_subscriptions 
        SET status = 'past_due', updated_at = ?
        WHERE stripe_subscription_id = ?
      `).bind(now, invoice.subscription).run();
      
      console.log(`[WEBHOOK] ✅ Updated subscription ${invoice.subscription} to past_due status`);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error handling invoice payment failed:', error);
    throw error;
  }
} 