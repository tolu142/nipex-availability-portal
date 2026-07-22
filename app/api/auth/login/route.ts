import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Incomplete login payload credentials.' }, { status: 400 });
    }

    // 1. Locate the unique identity row inside 'availability_app' database
    const userQueryResult = await query('SELECT * FROM users WHERE email = $1', [email.trim()]);

    if (userQueryResult.rows.length === 0) {
      return NextResponse.json({ error: 'This email is not associated with an authorized profile.' }, { status: 401 });
    }

    const userRecord = userQueryResult.rows[0];

    // 1b. Verify that the user has activated their account via email
    if (!userRecord.is_verified) {
      return NextResponse.json({ 
        error: 'Your account is pending verification. Please check your email inbox to activate your profile.' 
      }, { status: 403 });
    }

    // 2. Compare the text login password against the hashed database string
    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Authentication failure. Invalid password token.' }, { status: 401 });
    }

    // 3. Format payload keys to mirror your frontend 'AuthUser' type properties exactly
    const authSessionUser = {
      id: userRecord.user_id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      specificTitle: userRecord.specific_title, 
      department: userRecord.department
    };

    return NextResponse.json({ message: 'Authentication verified.', user: authSessionUser }, { status: 200 });

  } catch (error) {
    console.error('Login Failure:', error);
    return NextResponse.json({ error: 'Internal server security processing error.' }, { status: 500 });
  }
}