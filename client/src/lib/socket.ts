import { io, type Socket } from 'socket.io-client';

import { API_BASE, tokenStore } from './api';

/** Mirrors server/src/socket/events.js — keep the two in step. */
export const EVENTS = {
  CONNECTED: 'connected',
  ONLINE_USERS: 'presence:online-users',
  USER_ONLINE: 'presence:user-online',
  USER_OFFLINE: 'presence:user-offline',

  JOIN_CONVERSATION: 'conversation:join',
  LEAVE_CONVERSATION: 'conversation:leave',
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_UPDATED: 'conversation:updated',

  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_READ: 'message:read',
  MESSAGE_DELIVERED: 'message:delivered',

  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  TYPING_UPDATE: 'typing:update',

  ERROR: 'app:error',
} as const;

let socket: Socket | null = null;

/**
 * Returns the singleton socket, connecting it on first use.
 *
 * The token is read lazily from `auth` on every (re)connect, so a refreshed
 * access token is picked up automatically after a reconnect.
 */
export function getSocket(): Socket {
  socket ??= io(API_BASE || window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 5000,
    auth: (cb) => cb({ token: tokenStore.get() }),
  });
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Promise wrapper around an ack-style emit. */
export function emitWithAck<T = unknown>(event: string, payload: unknown, timeout = 8000) {
  return new Promise<T>((resolve, reject) => {
    const s = getSocket();
    const timer = setTimeout(() => reject(new Error('ACK_TIMEOUT')), timeout);
    s.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}
