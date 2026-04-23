/**
 * Drive Service — Google Drive API Image Upload
 * 
 * Uploads receipt images to a designated Drive folder
 * and returns shareable URLs for sheet records.
 */

import { getDriveClient } from './google-auth.js';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

/**
 * Upload an image to Google Drive.
 * @param {Buffer} imageBuffer - Image data
 * @param {string} receiptId - Unique receipt identifier
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns {Object} { fileId, fileUrl }
 */
export async function uploadImage(imageBuffer, receiptId, mimeType = 'image/jpeg') {
  if (!FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');

  const drive = getDriveClient();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const fileName = `receipt_${dateStr}_${receiptId}.${ext}`;

  const stream = new Readable();
  stream.push(imageBuffer);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  // Make file viewable by anyone with the link
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    fileId: response.data.id,
    fileUrl: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
  };
}

/**
 * Get a direct thumbnail URL for a Drive file.
 */
export function getThumbnailUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
}
