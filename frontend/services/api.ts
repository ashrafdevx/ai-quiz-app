import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/login', data),

  me: () => api.get<{ user: User }>('/api/auth/me'),
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  stats: {
    totalSessions: number;
    avgScore: number;
    totalQuestions: number;
    totalAnswered: number;
    streak: number;
    bestScore: number;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}
