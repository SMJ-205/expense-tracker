/**
 * Quota API — GET /api/quota
 * 
 * Returns current month's OCR quota usage status.
 */

import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/quota-guard';

export async function GET() {
  try {
    const status = await getStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error('[quota] Error:', err);
    return NextResponse.json(
      { error: 'Failed to get quota status: ' + err.message },
      { status: 500 }
    );
  }
}
