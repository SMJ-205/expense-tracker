/**
 * Logger — Structured Logging
 * 
 * Writes log entries to both the Logs sheet and console.
 * Levels: INFO, WARN, ERROR
 */

import { appendLog } from './sheets-service.js';

export async function logInfo(fn, message, details = '') {
  console.log(`[INFO] [${fn}] ${message}`, details || '');
  await appendLog('INFO', fn, message, details);
}

export async function logWarn(fn, message, details = '') {
  console.warn(`[WARN] [${fn}] ${message}`, details || '');
  await appendLog('WARN', fn, message, details);
}

export async function logError(fn, message, details = '') {
  console.error(`[ERROR] [${fn}] ${message}`, details || '');
  await appendLog('ERROR', fn, message, details);
}
