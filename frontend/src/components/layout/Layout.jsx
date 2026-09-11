import React from 'react';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export function Layout({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <Navbar />
      <main className="app-main">
        <div className="app-container">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default Layout;
