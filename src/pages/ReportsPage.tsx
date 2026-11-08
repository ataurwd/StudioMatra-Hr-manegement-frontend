import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ReportsView } from '../components/ReportsView';

export const ReportsPage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  return <ReportsView currentUser={currentUser} />;
};

export default ReportsPage;

