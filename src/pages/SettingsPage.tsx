import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SettingsView } from '../components/SettingsView';

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  return <SettingsView currentUser={currentUser} />;
};

export default SettingsPage;

