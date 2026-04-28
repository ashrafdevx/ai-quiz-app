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
      const err: any = new Error(json?.message ?? json?.error ?? 'Upload failed');
      err.response = { status: res.status, data: json };
      throw err;
    }
    return { data: json as UploadResponse };
  },

  list: () => api.get<{ documents: Document[] }>('/api/documents'),

  get: (id: string) => api.get<{ document: Document }>(`/api/documents/${id}`),
};

// Question generation endpoints
export const questionsApi = {
  generate: (data: {
    text: string;
    count?: number;
    type?: string;
    difficulty?: string;
    focusAreas?: string[];
  }) => api.post<GenerateQuestionsResponse>('/api/questions/generate', data),
};

// Session endpoints
export const sessionsApi = {
  create:   (data: SessionCreateInput) => api.post<Session>('/api/sessions', data),
  list:     ()         => api.get<Session[]>('/api/sessions'),
  get:      (id: string) => api.get<Session>(`/api/sessions/${id}`),
  answer:   (id: string, questionId: number, transcript: string | null) =>
              api.put<Session>(`/api/sessions/${id}/answer`, { questionId, transcript }),
  complete: (id: string) => api.post<Session>(`/api/sessions/${id}/complete`, {}),
};

// Feedback endpoint
export const feedbackApi = {
  generate: (sessionId: string) => api.post<FeedbackResult>(`/api/feedback/${sessionId}`, {}),
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
  text?: string; // only present in GET /api/documents/:id
}

export interface Question {
  id: number;
  text: string;
  type: string;
  difficulty: string;
  hint: string[];
}

export interface Answer {
  questionId: number;
  transcript: string | null;
  recordedAt: string;
}

export interface Session {
  id: string;
  documentName: string;
  interviewType: string;
  difficulty: string;
  status: 'in_progress' | 'completed';
  questions: Question[];
  answers: Answer[];
  feedback: FeedbackResult | null;
  score: number;
  createdAt: string;
  completedAt: string | null;
}

export interface SessionCreateInput {
  documentName: string;
  extractedText: string;
  questions: Question[];
  interviewType?: string;
  difficulty?: string;
}

export interface GenerateQuestionsResponse {
  count: number;
  type: string;
  difficulty: string;
  questions: Question[];
}

export interface FeedbackResult {
  overall: number;
  grade: string;
  summary: string;
  dimensions: {
    clarity: number;
    confidence: number;
    relevance: number;
    grammar: number;
    vocabulary: number;
  };
  questions: {
    id: number;
    score: number;
    strengths: string[];
    improvements: string[];
    suggestedPhrase: string;
  }[];
  topTips: string[];
}

export interface UploadResponse {
  documentId: string;
  fileName: string;
  wordCount: number;
  charCount: number;
  status: string;
}

/** Extract user-facing message from any API or network error. */
export function extractMessage(
  err: any,
  fallback = 'Something went wrong. Please try again.'
): string {
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (data?.error)   return data.error;   // backward compat
  if (!err?.response) return 'Connection issue. Check your internet and try again.';
  return fallback;
}
