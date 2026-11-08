import React from 'react';
import { useAppContext } from '../context/AppContext';
import { EmployeesView } from '../components/EmployeesView';

export const EmployeesPage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  return <EmployeesView currentUser={currentUser} />;
};

export default EmployeesPage;

