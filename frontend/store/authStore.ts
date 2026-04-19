import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, type User } from '../services/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ token: data.token, user: data.user, isAuthenticated: true });
  },

  register: async (name, email, password) => {
    const { data } = await authApi.register({ name, email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ token: data.token, user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await authApi.me();
      set({ token, user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
