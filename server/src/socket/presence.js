'use strict';

/**
 * In-memory presence registry.
 *
 * A user may have several tabs/devices open, so we track a Set of socket ids
 * per user and only mark them offline once the last socket disconnects.
 * (For a multi-instance deployment swap this for the Socket.IO Redis adapter.)
 */
const userSockets = new Map(); // userId -> Set<socketId>
const socketUsers = new Map(); // socketId -> userId
const typingByRoom = new Map(); // conversationId -> Map<userId, timeoutId>

const addSocket = (userId, socketId) => {
  const id = String(userId);
  if (!userSockets.has(id)) userSockets.set(id, new Set());
  userSockets.get(id).add(socketId);
  socketUsers.set(socketId, id);
  return userSockets.get(id).size === 1; // became online
};

const removeSocket = (socketId) => {
  const userId = socketUsers.get(socketId);
  if (!userId) return { userId: null, wentOffline: false };
  socketUsers.delete(socketId);

  const set = userSockets.get(userId);
  if (!set) return { userId, wentOffline: true };

  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
    return { userId, wentOffline: true };
  }
  return { userId, wentOffline: false };
};

const isOnline = (userId) => userSockets.has(String(userId));
const getOnlineUserIds = () => [...userSockets.keys()];
const getSocketIds = (userId) => [...(userSockets.get(String(userId)) || [])];
const getUserId = (socketId) => socketUsers.get(socketId) || null;

const setTyping = (conversationId, userId, timeoutId) => {
  const room = String(conversationId);
  if (!typingByRoom.has(room)) typingByRoom.set(room, new Map());
  const map = typingByRoom.get(room);
  clearTimeout(map.get(String(userId)));
  map.set(String(userId), timeoutId);
};

const clearTyping = (conversationId, userId) => {
  const map = typingByRoom.get(String(conversationId));
  if (!map) return;
  clearTimeout(map.get(String(userId)));
  map.delete(String(userId));
  if (map.size === 0) typingByRoom.delete(String(conversationId));
};

const reset = () => {
  userSockets.clear();
  socketUsers.clear();
  typingByRoom.forEach((m) => m.forEach((t) => clearTimeout(t)));
  typingByRoom.clear();
};

module.exports = {
  addSocket,
  removeSocket,
  isOnline,
  getOnlineUserIds,
  getSocketIds,
  getUserId,
  setTyping,
  clearTyping,
  reset,
};
