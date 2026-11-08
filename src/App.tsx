/**
 * STUDIO MATRA — Office Attendance, HR & Payroll Management System
 * Modular Component-Based Architecture with Declarative Page Routing
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
