'use strict';

const { Server } = require('socket.io');

const env = require('../config/env');
const logger = require('../utils/logger');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const events = require('./events');
const presence = require('./presence');
const { setIO } = require('./io');
const registerHandlers = require('./handlers');
const { verifyAccessToken } = require('../utils/token');

/** Socket.IO handshake auth — mirrors the REST `protect` middleware. */
async function authenticate(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('UNAUTHORIZED'));

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select(User.PUBLIC_FIELDS);
    if (!user) return next(new Error('UNAUTHORIZED'));

    socket.user = user;
    return next();
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (env.clientUrls.includes(origin)) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
  });

  setIO(io);
  io.use(authenticate);

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id);
    const becameOnline = presence.addSocket(userId, socket.id);

    // Personal room: lets the API push events to every device of one user.
    socket.join(`user:${userId}`);

    // Auto-join every conversation the user belongs to.
    const conversations = await Conversation.find({ members: userId }).select('_id').lean();
    conversations.forEach((c) => socket.join(`conversation:${c._id}`));

    if (becameOnline) {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      socket.broadcast.emit(events.USER_ONLINE, { userId, at: new Date() });
    }

    socket.emit(events.CONNECTED, {
      userId,
      socketId: socket.id,
      rooms: conversations.map((c) => String(c._id)),
    });
    socket.emit(events.ONLINE_USERS, { userIds: presence.getOnlineUserIds() });

    logger.debug(`socket connected  ${socket.user.name} (${socket.id})`);

    registerHandlers(io, socket);

    socket.on('disconnect', async (reason) => {
      const { wentOffline } = presence.removeSocket(socket.id);
      if (wentOffline) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
        io.emit(events.USER_OFFLINE, { userId, lastSeen });
      }
      logger.debug(`socket disconnected ${socket.user.name} (${reason})`);
    });
  });

  return io;
}

module.exports = { initSocket, authenticate };
