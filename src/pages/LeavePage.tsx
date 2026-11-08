import React from 'react';
import { useAppContext } from '../context/AppContext';
import { LeaveView } from '../components/LeaveView';

export const LeavePage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  return <LeaveView currentUser={currentUser} />;
};

export default LeavePage;

