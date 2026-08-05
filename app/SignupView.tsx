'use client';

import React, { useState } from 'react';
import { UserRole, AuthUser } from './types';

interface SignupViewProps {
  onBack: () => void;
  onSignupSuccess: () => void;
}

export default function SignupView({ onBack, onSignupSuccess }: SignupViewProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [role, setRole] = useState<UserRole>('Intern');
  const [staffSubRole, setStaffSubRole] = useState('Market Systems Analyst');
  // Updated initial department to match database constraint ('IT', 'JQS', 'CRM', 'Services')
  const [department, setDepartment] = useState('IT'); 
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role, staffSubRole, department }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      alert('Account compiled and committed to database!');
      onSignupSuccess();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '40px 20px' }}>
      <div style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '40px', boxSizing: 'border-box' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: 600, padding: 0, marginBottom: '20px' }}>← Cancel</button>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: '#090d16' }}>Create Security Profile</h3>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>Register your credentials to claim node classification access.</p>
        
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Full Name</label>
            <input type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Corporate Email</label>
            <input type="email" placeholder="j.doe@nnpcgroup.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>
              Create Password
            </label>
            <input 
              type="password" 
              placeholder="Choose a secure password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Primary Structural Tier Group</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box', color: '#090d16' }}>
              <option value="Intern">Intern Matrix</option>
              <option value="Staff">Regular Staff Cadre</option>
              <option value="Manager IT">Manager IT</option>
              <option value="Deputy Manager">Deputy Manager</option>
              <option value="DM Application">DM Application</option>
              <option value="DM Infrastructure">DM Infrastructure</option>
              <option value="Head of NipeX">Head of NipeX (Executive Audit Only)</option>
            </select>
          </div>

          {role === 'Staff' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#005A1A' }}>Specific Assignment Title Role</label>
              <select value={staffSubRole} onChange={(e) => setStaffSubRole(e.target.value)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box', color: '#090d16' }}>
                <option value="Database Security Specialist">Database Security Specialist</option>
                <option value="Network Infrastructure Lead">Network Infrastructure Lead</option>
                <option value="Market Systems Analyst">Market Systems Analyst</option>
                <option value="Procurement Auditor">Procurement Auditor</option>
              </select>
            </div>
          )}

          {/* Department Selection Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Department Unit</label>
            <select 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)} 
              required 
              style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box', color: '#090d16' }}
            >
              <option value="IT">IT (Information Technology)</option>
              <option value="JQS">JQS (Joint Qualification System)</option>
              <option value="CRM">CRM (Customer Relationship Management)</option>
              <option value="Services">Services</option>
              <option value="HON office">HON office</option>
            </select>
          </div>

          <button type="submit" disabled={isLoading} style={{ backgroundColor: '#005A1A', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '10px', opacity: isLoading ? 0.6 : 1 }}>
            {isLoading ? 'Compiling Profile...' : 'Compile & Store Account Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}