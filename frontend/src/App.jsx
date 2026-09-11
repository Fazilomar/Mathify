import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';

import LandingPage from './pages/LandingPage';
import FeedPage from './pages/FeedPage';
import AITutorPage from './pages/AITutorPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProofsPage from './pages/ProofsPage';
import StudioPage from './pages/StudioPage';
import LibraryPage from './pages/LibraryPage';
import GroupsPage from './pages/GroupsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Mathify Caught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>📐</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>
            Mathematical Module Render Notice
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            A rendering exception occurred while processing this module.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{ padding: '10px 24px', fontWeight: 600 }}
          >
            Reload Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <ErrorBoundary>
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/proofs" element={<ProofsPage />} />
            <Route path="/studio" element={<ProofsPage />} />
            <Route path="/formulas" element={<StudioPage />} />
            <Route path="/tutor" element={<AITutorPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
