import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { PermissionKey, RoleName } from '../../types';
import { hasPermission } from '../../utils/permissions';
import { AccessDenied } from './AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactElement;
  permission?: PermissionKey;
  allowedRoles?: RoleName[];
  check?: (role: RoleName) => boolean;
  message?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  allowedRoles,
  check,
  message,
}) => {
  const { currentUser } = useAppContext();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = currentUser.role;

  let isAuthorized = true;

  if (permission && !hasPermission(role, permission)) {
    isAuthorized = false;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    isAuthorized = false;
  }

  if (check && !check(role)) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    return <AccessDenied currentRole={role} message={message} />;
  }

  return children;
};

