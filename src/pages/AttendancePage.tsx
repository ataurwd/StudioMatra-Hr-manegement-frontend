import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AttendanceView } from '../components/AttendanceView';

export const AttendancePage: React.FC = () => {
  const {
    currentUser,
    isOfficeNetwork,
    setIsOfficeNetwork,
    setIsKioskOpen,
  } = useAppContext();

  if (!currentUser) return null;

  return (
    <AttendanceView
      currentUser={currentUser}
      isOfficeNetwork={isOfficeNetwork}
      setIsOfficeNetwork={setIsOfficeNetwork}
      onOpenKiosk={() => setIsKioskOpen(true)}
    />
  );
};

export default AttendancePage;

