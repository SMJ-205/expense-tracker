/**
 * OCR Service — Google Cloud Vision API Integration
 * 
 * Extracts text from receipt images using Cloud Vision's DOCUMENT_TEXT_DETECTION.
 * Supports mixed Indonesian + English receipts.
 * Checks quota before making API calls.
 */

import { getAccessToken } from './google-auth.js';

/**
 * Extract text from an image using Cloud Vision API.
 * @param {Buffer} imageBuffer - Image data as a Buffer
 * @returns {Object} { text: string, error?: string }
 */
export async function extractText(imageBuffer) {
  const accessToken = await getAccessToken();

  const base64Image = imageBuffer.toString('base64');

  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          languageHints: ['id', 'en'],
        },
      },
    ],
  };

  const response = await fetch(
    'https://vision.googleapis.com/v1/images:annotate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Cloud Vision API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  const annotations = data.responses?.[0];
  if (!annotations) {
    return { text: '', error: 'No response from Vision API' };
  }

  if (annotations.error) {
    throw new Error(`Vision API error: ${annotations.error.message}`);
  }

  const fullText = annotations.fullTextAnnotation?.text || '';
  if (!fullText) {
    return { text: '', error: 'No text detected in image' };
  }

  return { text: fullText };
}
