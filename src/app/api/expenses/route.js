/**
 * Expenses API — GET /api/expenses
 * 
 * Returns expense history from Google Sheets.
 * Supports pagination via limit and offset query params.
 */

import { NextResponse } from 'next/server';
import { getExpenses } from '@/lib/sheets-service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const pin = searchParams.get('pin');

    // Basic auth check
    const usersJson = process.env.APP_USERS;
    if (usersJson) {
      try {
        const users = JSON.parse(usersJson);
        const validUser = users.find((u) => u.pin === pin);
        if (!validUser) {
          return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: 'Auth config error' }, { status: 500 });
      }
    }

    const expenses = await getExpenses(limit, offset);

    return NextResponse.json({
      expenses,
      count: expenses.length,
      offset,
      limit,
    });
  } catch (err) {
    console.error('[expenses] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch expenses: ' + err.message },
      { status: 500 }
    );
  }
}
