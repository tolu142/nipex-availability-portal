import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Configure Nodemailer with your SMTP details
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false 
  }
});

// Utility to get current Monday's date string (YYYY-MM-DD)
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  try {
    const { fullName, email, password, role, staffSubRole, department } = await request.json();

    if (!fullName || !email || !password || !role || !department) {
      return NextResponse.json({ error: 'Missing mandatory user profile properties.' }, { status: 400 });
    }

    const finalTitle = role === 'Staff' ? staffSubRole : role;

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 1. Generate a unique, secure verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 2. Write to 'users' table with is_verified = FALSE and store the token & department
    const userInsertResult = await query(
      `INSERT INTO users (name, email, password_hash, role, specific_title, department, is_verified, verification_token) 
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7) RETURNING user_id, name, email`,
      [fullName, email, passwordHash, role, finalTitle, department, verificationToken]
    );

    const newUser = userInsertResult.rows[0];

    // 3. Seed empty default weekly schedule tied to the current week_start_date
    const currentWeekStart = getCurrentWeekStart();
    
    await query(
      `INSERT INTO weekly_schedules (user_id, week_start_date, mon, tue, wed, thu, fri) 
       VALUES ($1, $2, 'On-Site', 'On-Site', 'On-Site', 'On-Site', 'On-Site')
       ON CONFLICT (user_id, week_start_date) DO NOTHING`,
      [newUser.user_id, currentWeekStart]
    );

    // 4. Send the Verification Email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationLink = `${appUrl}/api/auth/verify?token=${verificationToken}`;

    const mailOptions = {
      from: '"NipeX Portal" <noreply@nnpcgroup.com>',
      to: email,
      subject: 'Verify Your NipeX Console Account Identity',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #005A1A;">NipeX Logistics Portal</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>An account creation request was made using this email address. Please verify your identity and activate your node connection by clicking the link below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #005A1A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify & Activate Account</a>
          </div>
          <p style="font-size: 12px; color: #64748b;">If you did not make this request, you can safely ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      message: 'Account registered. Please check your corporate inbox to verify your email and activate your account.' 
    }, { status: 201 });

  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This corporate email is already registered.' }, { status: 409 });
    }
    console.error('Signup Failure:', error);
    return NextResponse.json({ error: 'Failed to process signup request.' }, { status: 500 });
  }
}