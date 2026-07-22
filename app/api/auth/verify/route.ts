import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing activation token.' }, { status: 400 });
    }

    // 1. Look up the user with this token
    const userResult = await query(
      'SELECT * FROM users WHERE verification_token = $1',
      [token]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired activation token.' }, { status: 400 });
    }

    const user = userResult.rows[0];

    // 2. Mark the user as verified and clear the token so it can't be reused
    await query(
      `UPDATE users 
       SET is_verified = TRUE, verification_token = NULL 
       WHERE user_id = $1`,
      [user.user_id]
    );

    // 3. Redirect them back to the login page with a success message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/?verified=true`);

  } catch (error) {
    console.error('Verification API Error:', error);
    return NextResponse.json({ error: 'Internal activation failure.' }, { status: 500 });
  }
}