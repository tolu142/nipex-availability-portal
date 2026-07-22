'use client';

import React, { useState } from 'react';
import LandingPage from './LandingPage';
import LoginView from './LoginView';
import SignupView from './SignupView';
import DashboardView from './DashboardView';
import { AuthUser } from './types';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'login' | 'signup' | 'dashboard'>('landing');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const handleLoginSuccess = (verifiedUser: AuthUser) => {
    setCurrentUser(verifiedUser);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('landing');
  };

  // Render Router Layout Engine
  if (currentScreen === 'landing') {
    return <LandingPage onNavigate={setCurrentScreen} />;
  }
  if (currentScreen === 'login') {
    return <LoginView onBack={() => setCurrentScreen('landing')} onLoginSuccess={handleLoginSuccess} />;
  }
  if (currentScreen === 'signup') {
    return <SignupView onBack={() => setCurrentScreen('landing')} onSignupSuccess={() => setCurrentScreen('login')} />;
  }
  if (currentScreen === 'dashboard' && currentUser) {
    return <DashboardView user={currentUser} onLogout={handleLogout} />;
  }

  return <LandingPage onNavigate={setCurrentScreen} />;
}