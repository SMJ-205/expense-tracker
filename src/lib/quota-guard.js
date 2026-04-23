/**
 * Quota Guard — OCR Quota Hard-Cap
 * 
 * Ensures the system never exceeds the Cloud Vision API free tier (1,000 pages/month).
 * Tracks usage in the QuotaUsage sheet tab.
 * When the limit is reached, processing halts until the monthly reset.
 */

import { getQuotaUsage, incrementQuotaUsage } from './sheets-service.js';

/**
 * Check if we can process another OCR request this month.
 * @returns {Object} { allowed: boolean, used: number, limit: number, remaining: number }
 */
export async function canProcess() {
  const usage = await getQuotaUsage();
  const remaining = usage.limit - usage.used;

  return {
    allowed: remaining > 0,
    used: usage.used,
    limit: usage.limit,
    remaining: Math.max(0, remaining),
    month: usage.month,
  };
}

/**
 * Increment the OCR usage counter after a successful API call.
 * @returns {Object} Updated quota status
 */
export async function incrementUsage() {
  const updated = await incrementQuotaUsage();
  return {
    used: updated.used,
    limit: updated.limit,
    remaining: Math.max(0, updated.limit - updated.used),
    month: updated.month,
  };
}

/**
 * Get current quota status for display in UI.
 * @returns {Object} { used, limit, remaining, month, percentUsed }
 */
export async function getStatus() {
  const usage = await getQuotaUsage();
  const remaining = Math.max(0, usage.limit - usage.used);
  const percentUsed = Math.round((usage.used / usage.limit) * 100);

  return {
    used: usage.used,
    limit: usage.limit,
    remaining,
    month: usage.month,
    percentUsed,
  };
}
