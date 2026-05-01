/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { Tasks } from './views/Tasks';
import { Shop } from './views/Shop';
import { HouseholdView } from './views/Household';
import { Onboarding } from './views/Onboarding';
import { Landing } from './views/Landing';
import { HistoryView } from './views/History';
import { NotificationService } from './services/NotificationService';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'tasks' | 'shop' | 'household' | 'history'>('dashboard');

  useEffect(() => {
    NotificationService.requestPermission();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  // If user is logged in but has no profile or no household, show onboarding
  if (!profile || !profile.householdId) {
    return <Onboarding />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentView} />;
      case 'tasks': return <Tasks />;
      case 'shop': return <Shop />;
      case 'household': return <HouseholdView />;
      case 'history': return <HistoryView />;
      default: return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
}

import { LanguageProvider } from './i18n/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
