'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    const checkAuth = () => {
      if (typeof window !== 'undefined') {
        const auth = localStorage.getItem('isAuthenticated');
        setIsAuthenticated(auth === 'true');
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'admin' && password === 'admin123') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAuthenticated', 'true');
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isAuthenticated');
    }
    setIsAuthenticated(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
