import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, onInvalidSession } from '../services/api';

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
  verifyEmail: (email: string, code: string) => Promise<void>;
  needsFirstPet: boolean;
  completeFirstPet: () => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsFirstPet, setNeedsFirstPet] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const currentToken = useRef<string | null>(null);

  useEffect(() => onInvalidSession(failedToken => {
    // A late failure from an old request must not sign out a newer login.
    if (currentToken.current !== failedToken) return;
    currentToken.current = null;
    setIsLoggedIn(false); setUser(null); setToken(null); setNeedsFirstPet(false);
    setError('Your session has expired. Please sign in again to load your pets and clinic records.');
    void AsyncStorage.multiRemove(['token','user']).catch(() => {});
  }), []);

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        
        if (savedToken && savedUser) {
          const cachedUser = JSON.parse(savedUser);
          currentToken.current = savedToken;
          let restoredUser = cachedUser;
          try { restoredUser = await authApi.getMe(savedToken); }
          catch (failure: any) {
            if (failure.status === 401 || failure.code === 'SESSION_INVALID' || failure.status === 403 && failure.message === 'Forbidden') return;
            // Keep the saved session on a temporary network failure so the owner can retry.
          }
          if (currentToken.current !== savedToken) return;
          setToken(savedToken);
          setUser(restoredUser);
          await AsyncStorage.setItem('user', JSON.stringify(restoredUser));
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        setIsRestoring(false);
      }
    };
    
    restoreSession();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const savedToken = currentToken.current;
      if (state === 'active' && savedToken) void authApi.getMe(savedToken).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  const saveSession = async (response: any, firstPet = false) => {
    if (!response.token || !response.user) throw new Error('Invalid login response');
    await AsyncStorage.multiSet([['token', response.token], ['user', JSON.stringify(response.user)]]);
    currentToken.current = response.token;
    setNeedsFirstPet(firstPet);
    setToken(response.token);
    setUser(response.user);
    setIsLoggedIn(true);
  };
  const verifyEmail = async (email: string, code: string) => {
    // The clinic creates the patient record first. Do not create a duplicate personal pet.
    await saveSession(await authApi.verifyEmail(email, code));
  };
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      
      if (!response.token || !response.user) {
        throw new Error('Invalid login response');
      }

      await saveSession(response);
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
      currentToken.current = null;
      setIsLoggedIn(false);
      setUser(null);
      setToken(null);
      setError(null);
      setNeedsFirstPet(false);
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
        verifyEmail,
        needsFirstPet,
        completeFirstPet: () => setNeedsFirstPet(false),
        logout,
        isLoading,
        isRestoring,
        error,
        clearError: () => setError(null),
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
