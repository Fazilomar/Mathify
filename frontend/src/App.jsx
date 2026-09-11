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

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
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
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
