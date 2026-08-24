'use strict';

/**
 * Holds the Socket.IO server instance so HTTP controllers can broadcast
 * without importing the whole socket bootstrap (and creating a cycle).
 */
let io = null;

const setIO = (instance) => { io = instance; };
const getIO = () => io;

/** Emits to a conversation room; a no-op when sockets are not running (e.g. tests). */
const emitToConversation = (conversationId, event, payload) => {
  if (io) io.to(`conversation:${conversationId}`).emit(event, payload);
};

/** Emits to every socket belonging to a user (their personal room). */
const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

const emitToUsers = (userIds, event, payload) => {
  userIds.forEach((id) => emitToUser(id, event, payload));
};

module.exports = { setIO, getIO, emitToConversation, emitToUser, emitToUsers };
