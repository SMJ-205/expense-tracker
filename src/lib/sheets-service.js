/**
 * Sheets Service — Google Sheets API Operations
 * 
 * Manages four sheet tabs: Expenses, Queue, Logs, QuotaUsage.
 * All read/write operations go through this module.
 */

import { getSheetsClient } from './google-auth.js';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getSheets() {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  return getSheetsClient();
}

// ─── Expenses Sheet ──────────────────────────────────────────────────

/**
 * Append a row to the Expenses sheet.
 * @param {Object} data - Expense fields
 */
export async function appendExpense(data) {
  const sheets = getSheets();
  const row = [
    data.timestamp || new Date().toISOString(),
    data.receipt_id || '',
    data.submitter || '',
    data.merchant_name || '',
    data.transaction_date || '',
    data.total_amount || '',
    data.tax_amount || '',
    data.service_charge || '',
    data.category || 'UNCATEGORIZED',
    data.notes || '',
    data.confidence_score || 0,
    data.raw_ocr_text || '',
    data.image_file_url || '',
    data.status || 'CONFIRMED',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Expenses!A:N',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/**
 * Get expenses with pagination and optional filters.
 */
export async function getExpenses(limit = 50, offset = 0) {
  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Expenses!A:N',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // Only header row

  const headers = rows[0];
  const dataRows = rows.slice(1).reverse(); // Most recent first

  const paginated = dataRows.slice(offset, offset + limit);

  return paginated.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

/**
 * Check if a receipt with this ID already exists.
 */
export async function isDuplicate(receiptId) {
  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Expenses!B:B',
  });

  const rows = response.data.values || [];
  return rows.some((row) => row[0] === receiptId);
}

// ─── Queue Sheet ─────────────────────────────────────────────────────

/**
 * Append an item to the Queue sheet (for quota-paused receipts).
 */
export async function appendToQueue(data) {
  const sheets = getSheets();
  const row = [
    data.received_at || new Date().toISOString(),
    data.receipt_id || '',
    data.submitter || '',
    data.image_file_url || '',
    data.processing_status || 'QUOTA_PAUSED',
    data.processed_at || '',
    data.error || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Queue!A:G',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/**
 * Get all items with QUOTA_PAUSED status from Queue.
 */
export async function getQuotaPausedItems() {
  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Queue!A:G',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const results = [];

  rows.slice(1).forEach((row, index) => {
    if (row[4] === 'QUOTA_PAUSED') {
      const obj = { _rowIndex: index + 2 }; // 1-indexed + header
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      results.push(obj);
    }
  });

  return results;
}

/**
 * Mark a Queue item as processed.
 */
export async function markQueueProcessed(rowIndex, status = 'PROCESSED', error = '') {
  const sheets = getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Queue!E${rowIndex}:G${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[status, new Date().toISOString(), error]],
    },
  });
}

// ─── Logs Sheet ──────────────────────────────────────────────────────

/**
 * Append a log entry.
 */
export async function appendLog(level, fn, message, details = '') {
  try {
    const sheets = getSheets();
    const row = [
      new Date().toISOString(),
      level,
      fn,
      message,
      typeof details === 'string' ? details : JSON.stringify(details),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Logs!A:E',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
  } catch (err) {
    // Logging should never throw
    console.error('[Logger] Failed to write log:', err.message);
  }
}

/**
 * Trim logs older than the specified number of days.
 */
export async function trimOldLogs(daysToKeep = 30) {
  const sheets = getSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Logs!A:A',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  // Find rows to delete (from bottom to top to preserve indices)
  const rowsToDelete = [];
  for (let i = 1; i < rows.length; i++) {
    const timestamp = new Date(rows[i][0]);
    if (timestamp < cutoff) {
      rowsToDelete.push(i);
    }
  }

  if (rowsToDelete.length === 0) return 0;

  // Get sheet ID for the Logs tab
  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets.properties',
  });

  const logsSheet = sheetMeta.data.sheets.find(
    (s) => s.properties.title === 'Logs'
  );
  if (!logsSheet) return 0;

  const sheetGid = logsSheet.properties.sheetId;

  // Delete rows from bottom to top
  const requests = rowsToDelete.reverse().map((rowIdx) => ({
    deleteDimension: {
      range: {
        sheetId: sheetGid,
        dimension: 'ROWS',
        startIndex: rowIdx,
        endIndex: rowIdx + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });

  return rowsToDelete.length;
}

// ─── QuotaUsage Sheet ────────────────────────────────────────────────

/**
 * Get current month's quota usage.
 */
export async function getQuotaUsage() {
  const sheets = getSheets();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'QuotaUsage!A:D',
  });

  const rows = response.data.values || [];

  // Find current month's row
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === currentMonth) {
      return {
        month: rows[i][0],
        used: parseInt(rows[i][1]) || 0,
        limit: parseInt(rows[i][2]) || 1000,
        lastUpdated: rows[i][3] || '',
        _rowIndex: i + 1,
      };
    }
  }

  // No row for current month — create one
  const limit = parseInt(process.env.OCR_MONTHLY_LIMIT) || 1000;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'QuotaUsage!A:D',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[currentMonth, 0, limit, new Date().toISOString()]],
    },
  });

  return { month: currentMonth, used: 0, limit, lastUpdated: new Date().toISOString(), _rowIndex: rows.length + 1 };
}

/**
 * Increment OCR usage counter for current month.
 */
export async function incrementQuotaUsage() {
  const sheets = getSheets();
  const usage = await getQuotaUsage();

  const newUsed = usage.used + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `QuotaUsage!B${usage._rowIndex}:D${usage._rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[newUsed, usage.limit, new Date().toISOString()]],
    },
  });

  return { ...usage, used: newUsed };
}

/**
 * Reset quota for a new month (called by cron).
 */
export async function resetMonthlyQuota(month) {
  const sheets = getSheets();
  const limit = parseInt(process.env.OCR_MONTHLY_LIMIT) || 1000;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'QuotaUsage!A:D',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[month, 0, limit, new Date().toISOString()]],
    },
  });
}
