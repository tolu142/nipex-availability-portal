'use client';

import React from 'react';

interface LandingPageProps {
  onNavigate: (view: 'landing' | 'login' | 'signup' | 'dashboard') => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const styles = {
    nnpcGreen: '#005A1A', 
    deepSlateBlack: '#090d16',
    pureWhite: '#ffffff',
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100vw', overflowX: 'hidden' }}>
      {/* NAVBAR */}
      <nav style={{ backgroundColor: styles.pureWhite, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50, width: '100%' }}>
        <div style={{ width: '100%', padding: '0 5%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/nipex-logo.png" alt="NipeX Logo" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => onNavigate('login')} style={{ backgroundColor: 'transparent', color: styles.deepSlateBlack, border: `1px solid ${styles.deepSlateBlack}`, fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Sign In</button>
            <button onClick={() => onNavigate('signup')} style={{ backgroundColor: styles.nnpcGreen, color: styles.pureWhite, border: 'none', fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Create Account</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ backgroundColor: styles.deepSlateBlack, color: styles.pureWhite, padding: '140px 5%', textAlign: 'center', borderBottom: `5px solid ${styles.nnpcGreen}`, flexGrow: 1, backgroundImage: 'linear-gradient(180deg, #090d16 0%, #111827 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '800px' }}>
          <span style={{ backgroundColor: 'rgba(0, 90, 26, 0.15)', color: '#4ade80', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', padding: '8px 20px', borderRadius: '30px', border: `1px solid ${styles.nnpcGreen}` }}>NNPC LOGISTICS ARCHITECTURE</span>
          <h1 style={{ fontSize: 'calc(26px + 2vw)', fontWeight: 800, margin: '24px 0' }}>Availability Scheduling & Rota System</h1>
          <p style={{ fontSize: '18px', color: '#94a3b8', lineHeight: '1.7', marginBottom: '40px' }}>Access your authorized secure portal to verify work logs, process hybrid rotations, and log unexpected emergency claims directly to the grid.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button onClick={() => onNavigate('signup')} style={{ backgroundColor: styles.nnpcGreen, color: styles.pureWhite, fontSize: '16px', fontWeight: 600, padding: '16px 36px', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0, 90, 26, 0.4)' }}>Get Started Now</button>
          </div>
        </div>
      </header>
    </div>
  );
}