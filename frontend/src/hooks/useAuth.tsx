import { useState, useEffect } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  const login = async (email: string, password: string) => {
    // ничего не делаем — реальный логин в Login.tsx сам сохранит токен
  };

  const register = async (email: string, password: string) => {
    // аналогично
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return { token, login, register, logout };
}
