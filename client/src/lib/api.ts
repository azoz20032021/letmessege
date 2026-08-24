import axios, { AxiosError, type AxiosInstance } from 'axios';

import type {
  ApiEnvelope,
  AuthPayload,
  Conversation,
  Message,
  SearchResult,
  User,
  Attachment,
  LocaleCode,
} from '@/types';

/** Empty in dev — Vite proxies /api to the API server, so cookies stay same-origin. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'lm.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const http: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Normalised error surface: every caller can rely on `.message` and `.code`. */
export class ApiClientError extends Error {
  code?: string;
  status?: number;
  details?: { field: string; message: string }[];

  constructor(message: string, opts: Partial<ApiClientError> = {}) {
    super(message);
    this.name = 'ApiClientError';
    Object.assign(this, opts);
  }
}

let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

/** Single-flight refresh so a burst of 401s only hits /auth/refresh once. */
async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= axios
    .post<ApiEnvelope<AuthPayload>>(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true })
    .then((res) => {
      const { accessToken } = res.data.data;
      tokenStore.set(accessToken);
      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; code?: string; details?: never }>) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (!error.response) {
      throw new ApiClientError('NETWORK', { code: 'NETWORK' });
    }

    const { status, data } = error.response;
    const code = data?.code;

    const isExpired = status === 401 && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN');
    const canRetry = original && !original._retried && !original.url?.includes('/auth/');

    if (isExpired && canRetry) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return http.request(original);
      }
      tokenStore.clear();
      onSessionExpired?.();
    }

    throw new ApiClientError(data?.message ?? 'Request failed', {
      code,
      status,
      details: data?.details,
    });
  }
);

const unwrap = <T>(promise: Promise<{ data: ApiEnvelope<T> }>) => promise.then((r) => r.data.data);

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; email: string; password: string; locale?: LocaleCode }) =>
    unwrap<AuthPayload>(http.post('/auth/register', body)),

  login: (body: { email: string; password: string }) =>
    unwrap<AuthPayload>(http.post('/auth/login', body)),

  demo: () => unwrap<AuthPayload>(http.post('/auth/demo')),

  logout: () => http.post('/auth/logout'),

  me: () => unwrap<{ user: User }>(http.get('/auth/me')),
};

// ── Users ───────────────────────────────────────────────────────────────────
export const userApi = {
  list: (q = '') => unwrap<{ users: User[] }>(http.get('/users', { params: { q } })),

  update: (body: { name?: string; bio?: string; locale?: LocaleCode }) =>
    unwrap<{ user: User }>(http.patch('/users/me', body)),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return unwrap<{ user: User }>(http.post('/users/me/avatar', form));
  },
};

// ── Conversations ───────────────────────────────────────────────────────────
export const conversationApi = {
  list: () => unwrap<{ conversations: Conversation[] }>(http.get('/conversations')),

  get: (id: string) => unwrap<{ conversation: Conversation }>(http.get(`/conversations/${id}`)),

  create: (body: { type: 'direct' | 'group'; memberIds: string[]; name?: string; description?: string }) =>
    unwrap<{ conversation: Conversation }>(http.post('/conversations', body)),

  update: (id: string, body: { name?: string; description?: string }) =>
    unwrap<{ conversation: Conversation }>(http.patch(`/conversations/${id}`, body)),

  addMembers: (id: string, memberIds: string[]) =>
    unwrap<{ conversation: Conversation }>(http.post(`/conversations/${id}/members`, { memberIds })),

  removeMember: (id: string, userId: string) =>
    unwrap<{ conversation?: Conversation; deleted?: boolean }>(
      http.delete(`/conversations/${id}/members/${userId}`)
    ),

  markRead: (id: string) => unwrap<{ conversationId: string }>(http.post(`/conversations/${id}/read`)),

  messages: (id: string, params: { limit?: number; before?: string } = {}) =>
    unwrap<{ messages: Message[]; hasMore: boolean; nextCursor: string | null }>(
      http.get(`/conversations/${id}/messages`, { params })
    ),
};

// ── Messages ────────────────────────────────────────────────────────────────
export const messageApi = {
  edit: (id: string, text: string) =>
    unwrap<{ message: Message }>(http.patch(`/messages/${id}`, { text })),

  remove: (id: string) => unwrap<{ messageId: string }>(http.delete(`/messages/${id}`)),

  search: (q: string, conversationId?: string) =>
    unwrap<{ results: SearchResult[]; count: number }>(
      http.get('/messages/search', { params: { q, ...(conversationId ? { conversationId } : {}) } })
    ),
};

// ── Uploads ─────────────────────────────────────────────────────────────────
export const uploadApi = {
  files: (files: File[], onProgress?: (percent: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));

    return unwrap<{ attachments: Attachment[] }>(
      http.post('/uploads', form, {
        onUploadProgress: (e) => {
          if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
        },
      })
    );
  },
};

/** Turns a possibly-relative upload path into an absolute URL. */
export const assetUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE}${url}`;
