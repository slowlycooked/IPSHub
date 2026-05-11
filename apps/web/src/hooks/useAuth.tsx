import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import type { User } from '@/types/api';
import { queryClient } from '@/api/queryClient';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const { isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const data = await authApi.me();
        if (data?.user) {
          setUser(data.user);
          return data.user;
        }
        setUser(null);
        return null;
      } catch {
        setUser(null);
        return null;
      }
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login({ username, password }),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login: async (username, password) => {
          await loginMutation.mutateAsync({ username, password });
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        refreshAuth: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
