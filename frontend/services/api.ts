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

  delete: (id: string) => api.delete<{ success: boolean }>(`/api/documents/${id}`),

  transcribe: async (formData: FormData): Promise<{ transcript: string }> => {
    const token = await SecureStore.getItemAsync('auth_token');
    const res = await fetch(`${BASE_URL}/api/documents/transcribe`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      const err: any = new Error(json?.message ?? 'Transcription failed');
      err.response = { status: res.status, data: json };
      throw err;
    }
    return json as { transcript: string };
  },

  fromText: (text: string, name: string) =>
    api.post<UploadResponse>('/api/documents/from-text', { text, name }),
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

// Analytics endpoint
export const analyticsApi = {
  performance: () => api.get<PerformanceData>('/api/analytics/performance'),
};

// Voice answer endpoint
export const voiceAnswerApi = {
  submit: async (
    sessionId: string,
    audioUri: string,
    questionId: number,
    duration?: number
  ): Promise<VoiceAnswerResult> => {
    const token = await SecureStore.getItemAsync('auth_token');

    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      name: 'answer.m4a',
      type: 'audio/m4a',
    } as any);
    formData.append('questionId', String(questionId));
    if (duration) formData.append('duration', String(Math.round(duration)));

    const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}/voice-answer`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(`[API] ${res.status} POST /api/sessions/${sessionId}/voice-answer`, json);
      const err: any = new Error(json?.message ?? json?.error ?? 'Voice submission failed');
      err.response = { status: res.status, data: json };
      throw err;
    }
    return json as VoiceAnswerResult;
  },
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

export interface SpeechQuality {
  wordCount: number;
  wpm: number | null;
  fillerCount: number;
  fillerWords: string[];
  uniqueWordRatio: number;
}

export interface SingleEvaluation {
  score: number;
  feedback?: string;
  strengths: string[];
  improvements: string[];
  suggestedPhrase: string;
  improvedAnswer?: string;
}

export interface VoiceAnswerResult {
  questionId: number;
  transcript: string;
  speechQuality: SpeechQuality;
  evaluation: SingleEvaluation;
  contentScore: number;   // 0-100, from AI evaluation
  speechScore: number;    // 0-100, from speech metrics
  compositeScore: number; // 0-100, content×0.7 + speech×0.3
}

export interface ScoreEntry {
  sessionId:     string;
  date:          string;
  score:         number;
  documentName:  string;
  interviewType: string;
  difficulty:    string;
}

export interface PerformanceData {
  scoreHistory:  ScoreEntry[];
  avgScore:      number;
  bestScore:     number;
  totalSessions: number;
  totalAnswered: number;
  streak:        number;
  weakTopics:    string[];
  recentTrend:   'improving' | 'declining' | 'stable';
}

export interface UploadResponse {
  documentId: string;
  fileName: string;
  wordCount: number;
  charCount: number;
  status: string;
}

// Daily Quest API
export const dailyQuestApi = {
  today:   ()                                                        => api.get<DailyQuestPlan>('/api/daily-quest/today'),
  submit:  (planId: string, questionId: number, userAnswer: string) =>
             api.post<DailyQuestSubmitResult>('/api/daily-quest/submit', { planId, questionId, userAnswer }),
  history: (limit = 100, skip = 0)                                  =>
             api.get<DailyQuestHistory>(`/api/daily-quest/history?limit=${limit}&skip=${skip}`),
};

// Daily Quest types
export interface DailyQuestQuestion {
  id:            number;
  question:      string;
  correctAnswer: string;
  tips:          string[];
  topic:         string;
  difficulty:    'easy' | 'medium' | 'hard';
  answered:      boolean;
  entryId:       string | null;
  entry:         DailyQuestEntry | null; // embedded by /today when already answered
}

export interface DailyQuestPlan {
  _id:       string;
  date:      string;
  questions: DailyQuestQuestion[];
}

export interface DailyQuestEntry {
  _id:           string;
  date:          string;
  questionId:    number;
  question:      string;
  userAnswer:    string;
  correctAnswer: string;
  tips:          string[];
  topic:         string;
  difficulty:    'easy' | 'medium' | 'hard';
  isCorrect:     boolean;
  score:         number;
  feedback:      string;
  completedAt:   string;
}

export interface DailyQuestSubmitResult {
  entry:         DailyQuestEntry;
  isCorrect:     boolean;
  score:         number;
  correctAnswer: string;
  tips:          string[];
  feedback:      string;
}

export interface DailyQuestDay {
  date:     string;          // YYYY-MM-DD UTC
  entries:  DailyQuestEntry[];
  correct:  number;
  total:    number;
  avgScore: number;
}

export interface DailyQuestHistory {
  days:  DailyQuestDay[];
  total: number;
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
