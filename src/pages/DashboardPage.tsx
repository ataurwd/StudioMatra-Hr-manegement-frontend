import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { AdminDashboard } from '../components/AdminDashboard';
import { EmployeeDashboard } from '../components/EmployeeDashboard';

export const DashboardPage: React.FC = () => {
  const { currentUser, isOfficeNetwork } = useAppContext();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const handleNavigate = (path: string) => {
    const target = path.startsWith('/') ? path : `/${path}`;
    navigate(target);
  };

  if (currentUser.role === 'employee') {
    return (
      <EmployeeDashboard
        currentUser={currentUser}
        onNavigate={handleNavigate}
        isOfficeNetwork={isOfficeNetwork}
      />
    );
  }

  return (
    <AdminDashboard
      currentUser={currentUser}
      onNavigate={handleNavigate}
    />
  );
};

export default DashboardPage;

