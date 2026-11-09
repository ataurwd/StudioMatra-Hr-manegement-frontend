import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../db/database';
import { NotificationItem, User } from '../types';
import { syncWithBackend, apiLogin, apiChangePassword } from '../services/apiService';

const AUTH_STORAGE_KEY = 'studio_matra_auth_user_v4';

export interface AppContextType {
  currentUser: User | null;
  users: User[];
  isAuthenticated: boolean;
  login: (email: string, pass: string) => User;
  logout: () => void;
  changePassword: (currentPass: string, newPass: string) => boolean;
  isOfficeNetwork: boolean;
  setIsOfficeNetwork: React.Dispatch<React.SetStateAction<boolean>>;
  isKioskOpen: boolean;
  setIsKioskOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChangePasswordOpen: boolean;
  setIsChangePasswordOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openChangePassword: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  refreshNotifications: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => db.getUsers());

  // Load authenticated user from localStorage, or null
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Verify user still exists in DB
        const existing = db.getUserById(parsed.id);
        if (existing && existing.accountStatus === 'active') {
          return existing;
        }
      }
    } catch (e) {
      console.warn('Failed to parse authenticated user', e);
    }
    return null;
  });

  const [isOfficeNetwork, setIsOfficeNetwork] = useState<boolean>(true);
  const [isKioskOpen, setIsKioskOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshNotifications = () => {
    if (currentUser?.id) {
      setNotifications(db.getNotifications(currentUser.id));
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    // Attempt background sync with backend API on mount
    syncWithBackend().catch(() => {});

    const handleDbUpdate = () => {
      setUsers(db.getUsers());
      setCurrentUser((prev) => {
        if (prev?.id) {
          const freshUser = db.getUserById(prev.id);
          if (freshUser && freshUser.accountStatus === 'active') {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(freshUser));
            return freshUser;
          }
        }
        try {
          const stored = localStorage.getItem(AUTH_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            const fresh = db.getUserById(parsed.id);
            if (fresh && fresh.accountStatus === 'active') {
              return fresh;
            }
          }
        } catch {}
        return prev;
      });
      refreshNotifications();
    };

    handleDbUpdate();
    const unsubscribe = db.subscribe(handleDbUpdate);
    return unsubscribe;
  }, [currentUser?.id]);

  const login = (email: string, pass: string): User => {
    const authenticated = db.authenticateUser(email, pass);
    setCurrentUser(authenticated);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticated));
    setNotifications(db.getNotifications(authenticated.id));
    // Trigger background API sync
    apiLogin(email, pass).then((res) => {
      if (res && res.user) {
        syncWithBackend().catch(() => {});
      }
    }).catch(() => {});
    return authenticated;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setNotifications([]);
  };

  const changePassword = (currentPass: string, newPass: string): boolean => {
    if (!currentUser) throw new Error('Not authenticated');
    const result = db.changePassword(currentUser.id, currentPass, newPass);
    const fresh = db.getUserById(currentUser.id);
    if (fresh) {
      setCurrentUser(fresh);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fresh));
    }
    // Update password in MySQL via REST API
    apiChangePassword(currentUser.id, currentPass, newPass).catch(() => {});
    return result;
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        isAuthenticated: !!currentUser,
        login,
        logout,
        changePassword,
        isOfficeNetwork,
        setIsOfficeNetwork,
        isKioskOpen,
        setIsKioskOpen,
        isNotificationsOpen,
        setIsNotificationsOpen,
        isMobileNavOpen,
        setIsMobileNavOpen,
        isChangePasswordOpen,
        setIsChangePasswordOpen,
        openChangePassword: () => setIsChangePasswordOpen(true),
        notifications,
        unreadCount,
        refreshNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export { useAppContext } from './useAppContext';
