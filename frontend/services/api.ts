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

// Log every API error in one place
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const method = err.config?.method?.toUpperCase() ?? '?';
    const url    = err.config?.url ?? '?';
    const status = err.response?.status;
    const body   = err.response?.data;
    if (status) {
      console.error(`[API] ${status} ${method} ${url}`, body);
    } else {
      console.error(`[API] Network error ${method} ${url}`, err.message);
    }
    return Promise.reject(err);
  }
);

// Auth endpoints
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/login', data),

  me: () => api.get<{ user: User }>('/api/auth/me'),
};

// Document endpoints
export const documentsApi = {
  // fetch instead of axios — RN's native fetch sets multipart/form-data + boundary automatically
  upload: async (formData: FormData): Promise<{ data: UploadResponse }> => {
    const token = await SecureStore.getItemAsync('auth_token');
    const res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(`[API] ${res.status} POST /api/documents/upload`, json);
      const err: any = new Error(json?.error ?? 'Upload failed');
      err.response = { status: res.status, data: json };
      throw err;
    }
    return { data: json as UploadResponse };
  },

  list: () => api.get<{ documents: Document[] }>('/api/documents'),

  get: (id: string) => api.get<{ document: Document }>(`/api/documents/${id}`),
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

export interface Document {
  _id: string;
  fileName: string;
  wordCount: number;
  charCount: number;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
}

export interface UploadResponse {
  documentId: string;
  fileName: string;
  wordCount: number;
  charCount: number;
  status: string;
}
