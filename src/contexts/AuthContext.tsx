import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';

interface AuthContextProps {
  children: ReactNode;
}

interface AuthContextValue {
  user: any;
  profile: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<AuthContextProps> = ({ children }) => {
  const { user, profile, loading, signIn, signOut, updateProfile, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};