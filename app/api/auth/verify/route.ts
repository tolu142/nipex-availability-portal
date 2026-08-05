import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function POST(request: Request) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and verification token are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Look up user with matching email and verification token
    const userResult = await query(
      'SELECT * FROM users WHERE LOWER(email) = $1 AND verification_token = $2',
      [cleanEmail, token.trim()]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code.' },
        { status: 400 }
      );
    }

    const user = userResult.rows[0];

    // 2. Mark user as verified and clear the token
    await query(
      `UPDATE users 
       SET is_verified = TRUE, verification_token = NULL 
       WHERE user_id = $1`,
      [user.user_id]
    );

    // 3. Return session payload formatted for AuthUser
    const authSessionUser = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role || 'Staff',
      specificTitle: user.specific_title,
      department: user.department,
    };

    return NextResponse.json(
      { message: 'Account successfully verified.', user: authSessionUser },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal activation failure.' },
      { status: 500 }
    );
  }
}