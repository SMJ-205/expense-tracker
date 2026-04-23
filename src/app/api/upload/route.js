/**
 * Upload API — POST /api/upload
 * 
 * Receives a receipt image, runs OCR, parses fields.
 * Returns parsed data for user review before confirming.
 */

import { NextResponse } from 'next/server';
import { extractText } from '@/lib/ocr-service';
import { parseReceipt } from '@/lib/parser';
import { canProcess, incrementUsage } from '@/lib/quota-guard';
import { uploadImage } from '@/lib/drive-service';
import { appendToQueue } from '@/lib/sheets-service';
import { logInfo, logError, logWarn } from '@/lib/logger';

/**
 * Validate PIN and return user info.
 */
function authenticateUser(pin) {
  const usersJson = process.env.APP_USERS;
  if (!usersJson) return null;

  try {
    const users = JSON.parse(usersJson);
    return users.find((u) => u.pin === pin) || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pin = formData.get('pin');
    const imageFile = formData.get('image');

    // Authenticate
    const user = authenticateUser(pin);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Check quota
    const quota = await canProcess();

    if (!quota.allowed) {
      // Save image to Drive anyway
      let imageUrl = '';
      try {
        const uploaded = await uploadImage(imageBuffer, receiptId, imageFile.type);
        imageUrl = uploaded.fileUrl;
      } catch (driveErr) {
        await logError('upload', 'Failed to save image to Drive during quota pause', driveErr.message);
      }

      // Queue as QUOTA_PAUSED
      await appendToQueue({
        receipt_id: receiptId,
        submitter: user.name,
        image_file_url: imageUrl,
        processing_status: 'QUOTA_PAUSED',
      });

      await logWarn('upload', `Quota exhausted. Receipt queued: ${receiptId}`, { user: user.name });

      return NextResponse.json({
        status: 'QUOTA_PAUSED',
        receipt_id: receiptId,
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: 0,
        },
        message: `Monthly OCR quota reached (${quota.used}/${quota.limit}). Your receipt has been saved and will be processed on the 1st of next month.`,
      });
    }

    // Run OCR
    const ocrResult = await extractText(imageBuffer);

    if (ocrResult.error && !ocrResult.text) {
      await logWarn('upload', `OCR returned no text: ${ocrResult.error}`, { receiptId });
      return NextResponse.json({
        status: 'OCR_FAILED',
        receipt_id: receiptId,
        error: ocrResult.error,
        parsed: {
          merchant_name: 'Unknown Merchant',
          transaction_date: '',
          total_amount: '',
          tax_amount: '',
          service_charge: '',
          payment_method: '',
          category: 'UNCATEGORIZED',
          confidence_score: 0,
          raw_ocr_text: '',
          status: 'NEEDS_REVIEW',
        },
      });
    }

    // Increment quota counter
    const updatedQuota = await incrementUsage();

    // Parse the receipt
    const parsed = parseReceipt(ocrResult.text);

    await logInfo('upload', `Receipt parsed: ${receiptId}`, {
      user: user.name,
      merchant: parsed.merchant_name,
      total: parsed.total_amount,
      confidence: parsed.confidence_score,
    });

    return NextResponse.json({
      status: 'PARSED',
      receipt_id: receiptId,
      submitter: user.name,
      parsed,
      imageBase64: imageBuffer.toString('base64'),
      imageMimeType: imageFile.type,
      quota: {
        used: updatedQuota.used,
        limit: updatedQuota.limit,
        remaining: updatedQuota.remaining,
      },
    });
  } catch (err) {
    console.error('[upload] Unexpected error:', err);
    await logError('upload', 'Unexpected error', err.message).catch(() => {});
    return NextResponse.json(
      { error: 'Processing failed: ' + err.message },
      { status: 500 }
    );
  }
}
