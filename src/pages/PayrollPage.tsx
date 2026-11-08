import React from 'react';
import { useAppContext } from '../context/AppContext';
import { PayrollView } from '../components/PayrollView';

export const PayrollPage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  return <PayrollView currentUser={currentUser} />;
};

export default PayrollPage;

