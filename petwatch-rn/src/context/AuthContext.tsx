import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/api';

interface User {
  id: string;
  name?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthCtx {
  isLoggedIn: boolean;
  user: User | null;
  userEmail: string;
  userName: string;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      }
    };
    
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      
      if (!response.token || !response.user) {
        throw new Error('Invalid login response');
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem('token', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));

      // Update state
      setToken(response.token);
      setUser(response.user);
      setIsLoggedIn(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authApi.logout(token).catch(err => {
          // Logout from backend may fail, but we still want to clear local state
          console.warn('Backend logout failed:', err);
        });
      }

      await AsyncStorage.multiRemove(['token', 'user']);
      setIsLoggedIn(false);
      setUser(null);
      setToken(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        userEmail: user?.email || '',
        userName: user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        token,
        login,
        logout,
        isLoading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
