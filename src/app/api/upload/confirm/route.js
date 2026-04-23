/**
 * Confirm API — POST /api/upload/confirm
 * 
 * After user reviews and edits parsed data, this endpoint
 * saves the final expense to Google Sheets and uploads the image to Drive.
 */

import { NextResponse } from 'next/server';
import { uploadImage } from '@/lib/drive-service';
import { appendExpense, isDuplicate } from '@/lib/sheets-service';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      receipt_id,
      submitter,
      confirmed_fields,
      image_base64,
      image_mime_type,
    } = body;

    if (!receipt_id || !confirmed_fields) {
      return NextResponse.json(
        { error: 'Missing required fields: receipt_id, confirmed_fields' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const duplicate = await isDuplicate(receipt_id);
    if (duplicate) {
      return NextResponse.json(
        { error: 'This receipt has already been saved.', receipt_id },
        { status: 409 }
      );
    }

    // Upload image to Drive
    let imageUrl = '';
    if (image_base64) {
      try {
        const imageBuffer = Buffer.from(image_base64, 'base64');
        const uploaded = await uploadImage(
          imageBuffer,
          receipt_id,
          image_mime_type || 'image/jpeg'
        );
        imageUrl = uploaded.fileUrl;
      } catch (driveErr) {
        await logError('confirm', 'Drive upload failed', driveErr.message);
        // Continue anyway — we still want to save the expense data
      }
    }

    // Save to Expenses sheet
    await appendExpense({
      timestamp: new Date().toISOString(),
      receipt_id,
      submitter: submitter || '',
      merchant_name: confirmed_fields.merchant_name || '',
      transaction_date: confirmed_fields.transaction_date || '',
      total_amount: confirmed_fields.total_amount || '',
      tax_amount: confirmed_fields.tax_amount || '',
      service_charge: confirmed_fields.service_charge || '',
      category: confirmed_fields.category || 'UNCATEGORIZED',
      notes: confirmed_fields.notes || '',
      confidence_score: confirmed_fields.confidence_score || 0,
      raw_ocr_text: confirmed_fields.raw_ocr_text || '',
      image_file_url: imageUrl,
      status: confirmed_fields.status || 'CONFIRMED',
    });

    await logInfo('confirm', `Expense saved: ${receipt_id}`, {
      submitter,
      merchant: confirmed_fields.merchant_name,
      total: confirmed_fields.total_amount,
    });

    return NextResponse.json({
      status: 'SAVED',
      receipt_id,
      image_file_url: imageUrl,
    });
  } catch (err) {
    console.error('[confirm] Unexpected error:', err);
    await logError('confirm', 'Unexpected error', err.message).catch(() => {});
    return NextResponse.json(
      { error: 'Failed to save: ' + err.message },
      { status: 500 }
    );
  }
}
