'use client';

import React, { useState } from 'react';
import { AuthUser } from './types';

interface LoginViewProps {
  onBack: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

export default function LoginView({ onBack, onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpView, setShowOtpView] = useState(false);

  // Check dynamically if the email belongs to the corporate domain
  const isSsoDomain = email.trim().toLowerCase().endsWith('@nipex.com.ng');

  // Step 1: Initial Login or Request SSO Code
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password: isSsoDomain ? undefined : password, // Passwords aren't required for SSO
          isSso: isSsoDomain 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failure.');
      }

      // If backend dispatched an OTP code, switch to the code verification screen
      if (data.requiresOtp) {
        setShowOtpView(true);
      } else if (data.user) {
        // Direct login success for standard email + password
        onLoginSuccess(data.user);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit the 6-Digit Verification Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: otpToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code.');
      }

      onLoginSuccess(data.user);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '16px', padding: '40px', boxSizing: 'border-box' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: 600, padding: 0, marginBottom: '20px' }}>
          ← Cancel
        </button>

        {!showOtpView ? (
          <>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: '#090d16' }}>Sign In to Console</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              {isSsoDomain ? 'Corporate SSO domain detected.' : 'Enter your credential keys below.'}
            </p>
            
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Corporate Email</label>
                <input 
                  type="email" 
                  placeholder="name@nipex.com.ng" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} 
                />
              </div>

              {/* Hide the password field automatically if typing an SSO corporate email */}
              {!isSsoDomain && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Password Token</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required={!isSsoDomain} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} 
                  />
                </div>
              )}

              <button type="submit" disabled={isLoading} style={{ backgroundColor: '#005A1A', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '10px', opacity: isLoading ? 0.6 : 1 }}>
                {isLoading ? 'Verifying...' : isSsoDomain ? 'Send Access Code' : 'Verify Clearance'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: '#090d16' }}>Enter Access Code</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              We sent a 6-digit verification code to <strong style={{ color: '#090d16' }}>{email}</strong>.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>6-Digit Code</label>
                <input 
                  type="text" 
                  maxLength={6} 
                  placeholder="123456" 
                  value={otpToken} 
                  onChange={(e) => setOtpToken(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16', textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 700 }} 
                />
              </div>

              <button type="submit" disabled={isLoading} style={{ backgroundColor: '#005A1A', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '10px', opacity: isLoading ? 0.6 : 1 }}>
                {isLoading ? 'Verifying Code...' : 'Verify Code & Sign In'}
              </button>

              <button 
                type="button" 
                onClick={() => setShowOtpView(false)} 
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}
              >
                Change Email Address
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}