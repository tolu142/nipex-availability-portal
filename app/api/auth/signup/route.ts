import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import * as bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

// Configure Nodemailer with your SMTP details
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Prevents local SSL certificate errors during dev
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

    const cleanEmail = email.trim().toLowerCase();
    const finalTitle = role === 'Staff' ? staffSubRole : role;

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 1. Generate a 6-Digit OTP Code
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Write to 'users' table with is_verified = FALSE and store the 6-digit OTP code
    const userInsertResult = await query(
      `INSERT INTO users (name, email, password_hash, role, specific_title, department, is_verified, verification_token) 
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7) RETURNING user_id, name, email`,
      [fullName, cleanEmail, passwordHash, role, finalTitle, department, verificationToken]
    );

    const newUser = userInsertResult.rows[0];

    // 3. Seed empty default weekly schedule tied to the current week_start_date
    const currentWeekStart = getCurrentWeekStart();
    
    await query(
      `INSERT INTO weekly_schedules (user_id, week_start_date, mon, tue, wed, thu, fri) 
       VALUES ($1, $2, 'Available', 'Available', 'Available', 'Available', 'Available')
       ON CONFLICT (user_id, week_start_date) DO NOTHING`,
      [newUser.user_id, currentWeekStart]
    );

    // 4. Send the 6-Digit OTP Verification Email
    const mailOptions = {
      from: `"NipeX Console" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: 'Verify Your NipeX Console Account Identity',
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <h2 style="color: #090d16; margin-top: 0;">Account Verification Code</h2>
          <p style="color: #475569; font-size: 15px;">Hello <strong>${fullName}</strong>,</p>
          <p style="color: #475569; font-size: 15px;">Use the 6-digit access code below to verify your email and activate your profile on the NipeX Console:</p>
          
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #005A1A; text-align: center; margin: 28px 0; background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
            ${verificationToken}
          </div>
          
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Signup OTP successfully dispatched to: ${cleanEmail}`);
    } catch (mailError) {
      console.error('❌ Nodemailer SMTP Error during signup:', mailError);
      return NextResponse.json({ 
        error: 'Account created, but failed to send verification email. Please check SMTP settings.' 
      }, { status: 500 });
    }

    // 5. Signal the frontend to show the OTP entry screen
    return NextResponse.json({ 
      message: 'Account registered. Please enter the 6-digit code sent to your email.',
      requiresOtp: true,
      email: cleanEmail
    }, { status: 201 });

  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
    }
    console.error('Signup Failure:', error);
    return NextResponse.json({ error: 'Failed to process signup request.' }, { status: 500 });
  }
}