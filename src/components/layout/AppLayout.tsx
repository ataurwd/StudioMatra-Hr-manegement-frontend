import React, { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { KioskModal } from '../KioskModal';
import { NotificationsModal } from '../NotificationsModal';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';
import { PageLoader } from '../common/PageLoader';
import { useAppContext } from '../../context/AppContext';

export const AppLayout: React.FC = () => {
  const {
    currentUser,
    isKioskOpen,
    setIsKioskOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
  } = useAppContext();

  const location = useLocation();

  // Redirect unauthenticated visitors to login
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1c2120] flex font-sans antialiased selection:bg-[#CAA05C] selection:text-[#171c1b]">
      {/* Sleek Charcoal Architectural Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-68 flex flex-col min-w-0">
        {/* Top Header */}
        <Header />

        {/* View / Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Office Kiosk Terminal Modal */}
      <KioskModal
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
      />

      {/* In-App Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        userId={currentUser.id}
      />

      {/* Self-service Change Password Modal */}
      <ChangePasswordModal />
    </div>
  );
};

