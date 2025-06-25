import { D1Database } from '@cloudflare/workers-types';
import { generateId } from './generator';

// Types for SES event processing
export interface SESEvent {
  eventType: 'Bounce' | 'Complaint' | 'Delivery' | 'Open' | 'Click';
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
  };
  bounce?: {
    bounceType: 'Permanent' | 'Transient';
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action: string;
      status: string;
      diagnosticCode: string;
    }>;
    timestamp: string;
    feedbackId: string;
    reportingMTA?: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    timestamp: string;
    feedbackId: string;
    userAgent?: string;
    complaintFeedbackType?: string;
    arrivalDate?: string;
  };
  delivery?: {
    timestamp: string;
    processingTimeMillis: number;
    recipients: string[];
    smtpResponse: string;
    reportingMTA: string;
  };
}

export interface EmailSuppression {
  emailAddress: string;
  suppressionType: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe';
  reason?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface EmailRetry {
  id: string;
  emailAddress: string;
  messageId: string;
  retryCount: number;
  nextRetryAt: number;
  maxRetries: number;
  createdAt: number;
  lastError?: string;
}

export interface UnsubscribeRequest {
  id: string;
  emailAddress: string;
  userId?: string;
  reason?: string;
  processed: number;
  createdAt: number;
  processedAt?: number;
}

// Email Delivery Monitoring Service
export class EmailMonitoringService {
  private db: D1Database;
  private tablePrefix: string;

  constructor(db: D1Database, tablePrefix: string) {
    this.db = db;
    this.tablePrefix = tablePrefix;
  }

  /**
   * Process SES event from SNS notification
   */
  async processSESEvent(eventData: any): Promise<void> {
    console.log(`[EMAIL MONITORING] Processing SES event | Type: ${eventData.eventType}`);
    
    try {
      // Store the event in the database
      await this.storeEmailEvent(eventData);
      
      // Process based on event type
      switch (eventData.eventType) {
        case 'Bounce':
          await this.processBounce(eventData);
          break;
        case 'Complaint':
          await this.processComplaint(eventData);
          break;
        case 'Delivery':
          await this.processDelivery(eventData);
          break;
        default:
          console.log(`[EMAIL MONITORING] Unhandled event type: ${eventData.eventType}`);
      }
    } catch (error: any) {
      console.error(`[EMAIL MONITORING] Error processing SES event | Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store email event in database
   */
  private async storeEmailEvent(eventData: SESEvent): Promise<void> {
    const eventId = generateId();
    const timestamp = Math.floor(Date.now() / 1000);
    
    await this.db.prepare(`
      INSERT INTO ${this.tablePrefix}_email_events 
      (id, message_id, email_address, event_type, event_data, created_at, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      eventData.mail.messageId,
      eventData.mail.destination[0], // Assuming single recipient for now
      eventData.eventType,
      JSON.stringify(eventData),
      timestamp,
      0
    ).run();
    
    console.log(`[EMAIL MONITORING] Stored email event | ID: ${eventId} | Type: ${eventData.eventType}`);
  }

  /**
   * Process bounce events
   */
  private async processBounce(eventData: SESEvent): Promise<void> {
    if (!eventData.bounce) return;
    
    const bounceType = eventData.bounce.bounceType;
    const bouncedRecipients = eventData.bounce.bouncedRecipients;
    
    console.log(`[EMAIL MONITORING] Processing bounce | Type: ${bounceType} | Recipients: ${bouncedRecipients.length}`);
    
    for (const recipient of bouncedRecipients) {
      const emailAddress = recipient.emailAddress;
      
      if (bounceType === 'Permanent') {
        // Hard bounce - immediately remove from database and add to suppression list
        await this.handleHardBounce(emailAddress, recipient.diagnosticCode);
      } else {
        // Soft bounce - add to retry queue with exponential backoff
        await this.handleSoftBounce(emailAddress, eventData.mail.messageId, recipient.diagnosticCode);
      }
    }
  }

  /**
   * Handle hard bounce - remove user and add to permanent suppression
   */
  private async handleHardBounce(emailAddress: string, reason: string): Promise<void> {
    console.log(`[EMAIL MONITORING] Handling hard bounce | Email: ${emailAddress}`);
    
    // Add to suppression list (permanent)
    await this.addToSuppressionList(emailAddress, 'hard_bounce', reason);
    
    // Remove user from database
    await this.db.prepare(`
      DELETE FROM ${this.tablePrefix}_users 
      WHERE email = ?
    `).bind(emailAddress).run();
    
    // Remove any pending retries
    await this.db.prepare(`
      DELETE FROM ${this.tablePrefix}_email_retries 
      WHERE email_address = ?
    `).bind(emailAddress).run();
    
    console.log(`[EMAIL MONITORING] Hard bounce processed | Email: ${emailAddress} | User removed`);
  }

  /**
   * Handle soft bounce - add to retry queue
   */
  private async handleSoftBounce(emailAddress: string, messageId: string, reason: string): Promise<void> {
    console.log(`[EMAIL MONITORING] Handling soft bounce | Email: ${emailAddress}`);
    
    // Check if already in retry queue
    const existingRetry = await this.db.prepare(`
      SELECT * FROM ${this.tablePrefix}_email_retries 
      WHERE email_address = ? AND message_id = ?
    `).bind(emailAddress, messageId).first<EmailRetry>();
    
    if (existingRetry) {
      // Update existing retry with exponential backoff
      const newRetryCount = existingRetry.retryCount + 1;
      const nextRetryDelay = Math.min(Math.pow(2, newRetryCount) * 60, 24 * 60 * 60); // Max 24 hours
      const nextRetryAt = Math.floor(Date.now() / 1000) + nextRetryDelay;
      
      await this.db.prepare(`
        UPDATE ${this.tablePrefix}_email_retries 
        SET retry_count = ?, next_retry_at = ?, last_error = ?
        WHERE id = ?
      `).bind(newRetryCount, nextRetryAt, reason, existingRetry.id).run();
      
      console.log(`[EMAIL MONITORING] Updated retry | Email: ${emailAddress} | Retry: ${newRetryCount} | Next: ${new Date(nextRetryAt * 1000)}`);
    } else {
      // Create new retry entry
      const retryId = generateId();
      const nextRetryAt = Math.floor(Date.now() / 1000) + 60; // 1 minute initial delay
      
      await this.db.prepare(`
        INSERT INTO ${this.tablePrefix}_email_retries 
        (id, email_address, message_id, retry_count, next_retry_at, max_retries, created_at, last_error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(retryId, emailAddress, messageId, 1, nextRetryAt, 3, Math.floor(Date.now() / 1000), reason).run();
      
      console.log(`[EMAIL MONITORING] Created retry | Email: ${emailAddress} | Next: ${new Date(nextRetryAt * 1000)}`);
    }
  }

  /**
   * Process complaint events
   */
  private async processComplaint(eventData: SESEvent): Promise<void> {
    if (!eventData.complaint) return;
    
    const complainedRecipients = eventData.complaint.complainedRecipients;
    
    console.log(`[EMAIL MONITORING] Processing complaint | Recipients: ${complainedRecipients.length}`);
    
    for (const recipient of complainedRecipients) {
      const emailAddress = recipient.emailAddress;
      
      // Suspend user account immediately
      await this.suspendUserAccount(emailAddress, 'email_complaint');
      
      // Add to suppression list (permanent)
      await this.addToSuppressionList(emailAddress, 'complaint', 'User marked email as spam');
      
      // Remove any pending retries
      await this.db.prepare(`
        DELETE FROM ${this.tablePrefix}_email_retries 
        WHERE email_address = ?
      `).bind(emailAddress).run();
    }
  }

  /**
   * Suspend user account
   */
  private async suspendUserAccount(emailAddress: string, reason: string): Promise<void> {
    console.log(`[EMAIL MONITORING] Suspending user account | Email: ${emailAddress} | Reason: ${reason}`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    await this.db.prepare(`
      UPDATE ${this.tablePrefix}_users 
      SET is_suspended = 1, suspended_reason = ?, suspended_at = ?
      WHERE email = ?
    `).bind(reason, timestamp, emailAddress).run();
    
    console.log(`[EMAIL MONITORING] User account suspended | Email: ${emailAddress}`);
  }

  /**
   * Process delivery events
   */
  private async processDelivery(eventData: SESEvent): Promise<void> {
    console.log(`[EMAIL MONITORING] Processing delivery | MessageId: ${eventData.mail.messageId}`);
    
    // Remove any retry entries for this message
    await this.db.prepare(`
      DELETE FROM ${this.tablePrefix}_email_retries 
      WHERE message_id = ?
    `).bind(eventData.mail.messageId).run();
    
    console.log(`[EMAIL MONITORING] Delivery processed | MessageId: ${eventData.mail.messageId}`);
  }

  /**
   * Add email address to suppression list
   */
  private async addToSuppressionList(emailAddress: string, type: string, reason?: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    let expiresAt: number | null = null;
    
    // Set expiration based on suppression type
    switch (type) {
      case 'soft_bounce':
        expiresAt = timestamp + (30 * 24 * 60 * 60); // 30 days
        break;
      case 'hard_bounce':
      case 'complaint':
      case 'unsubscribe':
        expiresAt = null; // Permanent
        break;
    }
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tablePrefix}_email_suppressions 
      (email_address, suppression_type, reason, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(emailAddress, type, reason, timestamp, expiresAt).run();
    
    console.log(`[EMAIL MONITORING] Added to suppression list | Email: ${emailAddress} | Type: ${type}`);
  }

  /**
   * Check if email address is suppressed
   */
  async isEmailSuppressed(emailAddress: string): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    
    const suppression = await this.db.prepare(`
      SELECT * FROM ${this.tablePrefix}_email_suppressions 
      WHERE email_address = ? AND (expires_at IS NULL OR expires_at > ?)
    `).bind(emailAddress, now).first<EmailSuppression>();
    
    return !!suppression;
  }

  /**
   * Get pending retries that are ready to be processed
   */
  async getPendingRetries(): Promise<EmailRetry[]> {
    const now = Math.floor(Date.now() / 1000);
    
    const retries = await this.db.prepare(`
      SELECT * FROM ${this.tablePrefix}_email_retries 
      WHERE next_retry_at <= ? AND retry_count < max_retries
      ORDER BY next_retry_at ASC
    `).bind(now).all<EmailRetry>();
    
    return retries.results || [];
  }

  /**
   * Mark retry as processed (successful delivery or max retries reached)
   */
  async markRetryProcessed(retryId: string, success: boolean): Promise<void> {
    if (success) {
      // Remove the retry entry on successful delivery
      await this.db.prepare(`
        DELETE FROM ${this.tablePrefix}_email_retries 
        WHERE id = ?
      `).bind(retryId).run();
    } else {
      // Mark as processed but keep for record
      await this.db.prepare(`
        UPDATE ${this.tablePrefix}_email_retries 
        SET retry_count = retry_count + 1
        WHERE id = ?
      `).bind(retryId).run();
    }
  }

  /**
   * Process unsubscribe request
   */
  async processUnsubscribeRequest(emailAddress: string, reason?: string): Promise<void> {
    console.log(`[EMAIL MONITORING] Processing unsubscribe request | Email: ${emailAddress}`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Find user if exists
    const user = await this.db.prepare(`
      SELECT id FROM ${this.tablePrefix}_users 
      WHERE email = ?
    `).bind(emailAddress).first<{ id: string }>();
    
    // Create unsubscribe request
    const requestId = generateId();
    await this.db.prepare(`
      INSERT INTO ${this.tablePrefix}_unsubscribe_requests 
      (id, email_address, user_id, reason, processed, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(requestId, emailAddress, user?.id || null, reason, 0, timestamp).run();
    
    // Add to suppression list
    await this.addToSuppressionList(emailAddress, 'unsubscribe', reason || 'User requested unsubscribe');
    
    console.log(`[EMAIL MONITORING] Unsubscribe request created | Email: ${emailAddress} | ID: ${requestId}`);
  }

  /**
   * Process pending unsubscribe requests (should be called by a scheduled job)
   */
  async processPendingUnsubscribes(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Get pending requests older than 24 hours
    const pendingRequests = await this.db.prepare(`
      SELECT * FROM ${this.tablePrefix}_unsubscribe_requests 
      WHERE processed = 0 AND created_at <= ?
    `).bind(timestamp - (24 * 60 * 60)).all<UnsubscribeRequest>();
    
    console.log(`[EMAIL MONITORING] Processing ${pendingRequests.results?.length || 0} pending unsubscribe requests`);
    
    for (const request of pendingRequests.results || []) {
      // Mark as processed
      await this.db.prepare(`
        UPDATE ${this.tablePrefix}_unsubscribe_requests 
        SET processed = 1, processed_at = ?
        WHERE id = ?
      `).bind(timestamp, request.id).run();
      
      console.log(`[EMAIL MONITORING] Processed unsubscribe request | Email: ${request.emailAddress} | ID: ${request.id}`);
    }
  }

  /**
   * Clean up expired suppressions
   */
  async cleanupExpiredSuppressions(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    const result = await this.db.prepare(`
      DELETE FROM ${this.tablePrefix}_email_suppressions 
      WHERE expires_at IS NOT NULL AND expires_at <= ?
    `).bind(now).run();
    
    console.log(`[EMAIL MONITORING] Cleaned up ${result.meta?.changes || 0} expired suppressions`);
  }

  /**
   * Get email delivery statistics
   */
  async getDeliveryStats(): Promise<{
    totalEvents: number;
    deliveries: number;
    bounces: number;
    complaints: number;
    suppressions: number;
    pendingRetries: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    
    const [totalEvents, deliveries, bounces, complaints, suppressions, pendingRetries] = await Promise.all([
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_events`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_events WHERE event_type = 'Delivery'`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_events WHERE event_type = 'Bounce'`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_events WHERE event_type = 'Complaint'`).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_suppressions WHERE expires_at IS NULL OR expires_at > ?`).bind(now).first<{ count: number }>(),
      this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tablePrefix}_email_retries WHERE retry_count < max_retries`).first<{ count: number }>()
    ]);
    
    return {
      totalEvents: totalEvents?.count || 0,
      deliveries: deliveries?.count || 0,
      bounces: bounces?.count || 0,
      complaints: complaints?.count || 0,
      suppressions: suppressions?.count || 0,
      pendingRetries: pendingRetries?.count || 0
    };
  }
} 