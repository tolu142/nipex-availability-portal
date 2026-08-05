import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

// Configure Nodemailer transporter using environment variables
// Configure Nodemailer transporter with TLS override for local dev environment
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Prevents Node.js from throwing 'unable to verify the first certificate'
    rejectUnauthorized: false,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, isSso } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSsoDomain = cleanEmail.endsWith('@nipex.com.ng');

    // ------------------------------------------------------------------
    // 1. SSO FLOW (@nipex.com.ng)
    // ------------------------------------------------------------------
    if (isSso || isSsoDomain) {
      const userQueryResult = await query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);

      let userRecord;
      const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

      if (userQueryResult.rows.length === 0) {
        // Auto-provision brand new SSO user account
        const defaultName = cleanEmail.split('@')[0];

        const newUserResult = await query(
          `INSERT INTO users (name, email, password_hash, role, specific_title, department, is_verified, verification_token, created_at) 
           VALUES ($1, $2, 'SSO_USER_NO_PASSWORD', 'Staff', 'Unassigned', 'Unassigned', false, $3, NOW()) 
           RETURNING user_id, name, email, role, specific_title, department`,
          [defaultName, cleanEmail, verificationToken]
        );

        userRecord = newUserResult.rows[0];
      } else {
        userRecord = userQueryResult.rows[0];

        // Update existing SSO user record with fresh OTP
        await query(
          'UPDATE users SET verification_token = $1, is_verified = false WHERE user_id = $2',
          [verificationToken, userRecord.user_id]
        );
      }

      // Send the 6-Digit OTP Email via Nodemailer
      try {
        await transporter.sendMail({
          from: `"NipeX Console" <${process.env.SMTP_USER}>`,
          to: cleanEmail,
          subject: 'Your NipeX Access Clearance Code',
          html: `
            <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0;">
              <h2 style="color: #090d16; margin-top: 0;">Verification Access Code</h2>
              <p style="color: #475569; font-size: 15px;">Use the 6-digit code below to authenticate your session on the NipeX Console:</p>
              
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #005A1A; text-align: center; margin: 28px 0; background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
                ${verificationToken}
              </div>
              
              <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">If you did not attempt to sign in, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`OTP email successfully dispatched to: ${cleanEmail}`);
      } catch (mailError) {
        console.error('Nodemailer SMTP Error:', mailError);
        return NextResponse.json({ 
          error: 'Could not send verification email. Please verify SMTP server settings.' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'Verification code sent to email.', 
        requiresOtp: true,
        email: cleanEmail
      }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // 2. STANDARD EMAIL & PASSWORD LOGIN (Non-SSO Accounts)
    // ------------------------------------------------------------------
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const userResult = await query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = userResult.rows[0];

    // Verify Password Match
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Handle Unverified Standard Users by dispatching a new OTP code instead of failing
    if (!user.is_verified) {
      const freshOtpToken = Math.floor(100000 + Math.random() * 900000).toString();

      await query(
        'UPDATE users SET verification_token = $1 WHERE user_id = $2',
        [freshOtpToken, user.user_id]
      );

      try {
        await transporter.sendMail({
          from: `"NipeX Console" <${process.env.SMTP_USER}>`,
          to: cleanEmail,
          subject: 'Activate Your NipeX Console Account',
          html: `
            <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0;">
              <h2 style="color: #090d16; margin-top: 0;">Account Verification</h2>
              <p style="color: #475569; font-size: 15px;">Your account requires verification before signing in. Enter this 6-digit code to activate your profile:</p>
              
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #005A1A; text-align: center; margin: 28px 0; background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
                ${freshOtpToken}
              </div>
            </div>
          `,
        });
      } catch (mailError) {
        console.error(' Nodemailer SMTP Error:', mailError);
        return NextResponse.json({ error: 'Failed to send activation code.' }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'Account pending verification. A fresh 6-digit verification code has been emailed to you.', 
        requiresOtp: true,
        email: cleanEmail
      }, { status: 200 });
    }

    // Authentication Complete
    const authSessionUser = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role || 'Staff',
      specificTitle: user.specific_title,
      department: user.department,
    };

    return NextResponse.json({ message: 'Login successful.', user: authSessionUser }, { status: 200 });

  } catch (error) {
    console.error('Login Route Execution Error:', error);
    return NextResponse.json({ error: 'Internal server error processing login.' }, { status: 500 });
  }
}