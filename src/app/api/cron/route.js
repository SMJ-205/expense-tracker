/**
 * Cron API — GET /api/cron
 * 
 * Monthly quota reset + retry paused items.
 * Runs on the 1st of each month via Vercel Cron.
 * Protected by CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { resetMonthlyQuota, getQuotaPausedItems, markQueueProcessed, trimOldLogs } from '@/lib/sheets-service';
import { extractText } from '@/lib/ocr-service';
import { parseReceipt } from '@/lib/parser';
import { appendExpense } from '@/lib/sheets-service';
import { logInfo, logError } from '@/lib/logger';

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    await logInfo('cron', `Monthly reset started for ${currentMonth}`);

    // 1. Reset quota for new month
    await resetMonthlyQuota(currentMonth);

    // 2. Trim old logs (keep last 30 days)
    const trimmed = await trimOldLogs(30);
    await logInfo('cron', `Trimmed ${trimmed} old log entries`);

    // 3. Retry quota-paused items
    const pausedItems = await getQuotaPausedItems();
    let retried = 0;
    let failed = 0;

    for (const item of pausedItems) {
      try {
        // For now, we can only retry items that have images stored in Drive
        // The actual re-processing would need to download from Drive
        // Mark as needing manual review for this version
        await markQueueProcessed(item._rowIndex, 'NEEDS_MANUAL_RETRY', 'Automated retry pending Drive download implementation');
        retried++;
      } catch (retryErr) {
        await markQueueProcessed(item._rowIndex, 'FAILED', retryErr.message);
        failed++;
      }
    }

    await logInfo('cron', `Monthly reset complete`, {
      month: currentMonth,
      logsTrimmed: trimmed,
      pausedItemsFound: pausedItems.length,
      retried,
      failed,
    });

    return NextResponse.json({
      status: 'OK',
      month: currentMonth,
      logsTrimmed: trimmed,
      pausedItems: pausedItems.length,
      retried,
      failed,
    });
  } catch (err) {
    console.error('[cron] Error:', err);
    await logError('cron', 'Monthly reset failed', err.message).catch(() => {});
    return NextResponse.json(
      { error: 'Cron job failed: ' + err.message },
      { status: 500 }
    );
  }
}
