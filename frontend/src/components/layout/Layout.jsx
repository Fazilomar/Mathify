import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export function Layout({ children }) {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/oauth/callback'].some((path) =>
    location.pathname.startsWith(path)
  );
  const isFullHeightPage = ['/tutor', '/groups'].some((path) =>
    location.pathname.startsWith(path)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {!isAuthPage && <Navbar />}
      <main className={isAuthPage ? 'auth-main' : (isFullHeightPage ? 'app-main full-height-main' : 'app-main')}>
        <div className={isAuthPage ? 'auth-container' : (isFullHeightPage ? 'app-container full-height-container' : 'app-container')}>
          {children}
        </div>
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}

export default Layout;
