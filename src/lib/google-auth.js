/**
 * Google Auth — Service Account Authentication
 * 
 * Creates authenticated Google API clients using a service account JSON key
 * stored in the GOOGLE_SERVICE_ACCOUNT_KEY environment variable.
 */

import { google } from 'googleapis';

let cachedAuth = null;

/**
 * Get an authenticated Google Auth client.
 * Uses JWT credentials with scopes for Sheets, Drive, and Vision APIs.
 * Caches the client to avoid re-initialization on every request.
 */
export function getGoogleAuth() {
  if (cachedAuth) return cachedAuth;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  let credentials;
  try {
    credentials = JSON.parse(keyJson);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ' + err.message);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  });

  cachedAuth = auth;
  return auth;
}

/**
 * Get an authenticated Google Sheets client.
 */
export function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Get an authenticated Google Drive client.
 */
export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Get an access token for direct REST API calls (e.g., Cloud Vision).
 */
export async function getAccessToken() {
  const auth = getGoogleAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}
