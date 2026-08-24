'use strict';

/** Single source of truth for socket event names (mirrored in client/src/lib/socket.ts). */
module.exports = {
  // connection lifecycle
  CONNECTED: 'connected',
  ONLINE_USERS: 'presence:online-users',
  USER_ONLINE: 'presence:user-online',
  USER_OFFLINE: 'presence:user-offline',

  // rooms
  JOIN_CONVERSATION: 'conversation:join',
  LEAVE_CONVERSATION: 'conversation:leave',
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_UPDATED: 'conversation:updated',

  // messages
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_READ: 'message:read',
  MESSAGE_DELIVERED: 'message:delivered',

  // typing
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  TYPING_UPDATE: 'typing:update',

  ERROR: 'app:error',
};
