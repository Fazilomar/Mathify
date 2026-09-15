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
import MeetPage from './pages/MeetPage';
import DownloadPage from './pages/DownloadPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Crash in module:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444' }}>
          <h2>Something went wrong in this module.</h2>
          <p style={{ color: 'var(--text-muted)' }}>{this.state.error?.message || 'Unknown runtime error'}</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="btn-primary" 
            style={{ marginTop: '16px' }}
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
            <Route path="/meet/:meetingCode" element={<MeetPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
