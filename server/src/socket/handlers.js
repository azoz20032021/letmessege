'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const events = require('./events');
const presence = require('./presence');
const { POPULATE_MEMBERS, markRead } = require('../services/conversation.service');
const { sendMessageSchema } = require('../validators/schemas');

const TYPING_TIMEOUT_MS = 4000;

const room = (conversationId) => `conversation:${conversationId}`;

/** Resolves a conversation only if the socket's user is a member of it. */
async function memberConversation(conversationId, userId) {
  if (!/^[a-f\d]{24}$/i.test(String(conversationId || ''))) return null;
  const conversation = await Conversation.findById(conversationId).populate(POPULATE_MEMBERS);
  if (!conversation || !conversation.isMember(userId)) return null;
  return conversation;
}

const ack = (cb, payload) => typeof cb === 'function' && cb(payload);

function registerHandlers(io, socket) {
  const userId = String(socket.user._id);

  const fail = (message, code, cb) => {
    ack(cb, { success: false, message, code });
    socket.emit(events.ERROR, { message, code });
  };

  // ── Rooms ────────────────────────────────────────────────────────────────
  socket.on(events.JOIN_CONVERSATION, async ({ conversationId } = {}, cb) => {
    const conversation = await memberConversation(conversationId, userId);
    if (!conversation) return fail('Conversation not available', 'NOT_MEMBER', cb);

    socket.join(room(conversationId));
    await markRead(conversation, userId);

    io.to(room(conversationId)).emit(events.MESSAGE_READ, {
      conversationId: String(conversationId),
      userId,
      at: new Date(),
    });
    return ack(cb, { success: true, conversationId: String(conversationId) });
  });

  socket.on(events.LEAVE_CONVERSATION, ({ conversationId } = {}, cb) => {
    socket.leave(room(conversationId));
    presence.clearTyping(conversationId, userId);
    io.to(room(conversationId)).emit(events.TYPING_UPDATE, {
      conversationId: String(conversationId),
      userId,
      isTyping: false,
    });
    ack(cb, { success: true });
  });

  // ── Messages ─────────────────────────────────────────────────────────────
  socket.on(events.MESSAGE_SEND, async (payload = {}, cb) => {
    try {
      const conversation = await memberConversation(payload.conversationId, userId);
      if (!conversation) return fail('Conversation not available', 'NOT_MEMBER', cb);

      const parsed = sendMessageSchema.safeParse({
        text: payload.text ?? '',
        attachments: payload.attachments ?? [],
        replyTo: payload.replyTo ?? null,
      });
      if (!parsed.success) {
        return fail(parsed.error.issues[0].message, 'VALIDATION_ERROR', cb);
      }

      // Required lazily: the message controller imports the socket emitter.
      // eslint-disable-next-line global-require
      const { createMessage } = require('../controllers/message.controller');

      const message = await createMessage({
        conversation,
        sender: socket.user,
        text: parsed.data.text,
        attachments: parsed.data.attachments,
        replyTo: parsed.data.replyTo,
      });

      presence.clearTyping(conversation._id, userId);
      io.to(room(conversation._id)).emit(events.TYPING_UPDATE, {
        conversationId: String(conversation._id),
        userId,
        isTyping: false,
      });

      // `tempId` lets the client swap its optimistic bubble for the saved one.
      return ack(cb, { success: true, message, tempId: payload.tempId });
    } catch (err) {
      logger.error('message:send failed', err.message);
      return fail('Could not send the message', 'SEND_FAILED', cb);
    }
  });

  socket.on(events.MESSAGE_READ, async ({ conversationId } = {}, cb) => {
    const conversation = await memberConversation(conversationId, userId);
    if (!conversation) return fail('Conversation not available', 'NOT_MEMBER', cb);

    const at = new Date();
    await markRead(conversation, userId, at);
    io.to(room(conversationId)).emit(events.MESSAGE_READ, {
      conversationId: String(conversationId),
      userId,
      at,
    });
    return ack(cb, { success: true });
  });

  // ── Typing indicator ─────────────────────────────────────────────────────
  const broadcastTyping = (conversationId, isTyping) => {
    socket.to(room(conversationId)).emit(events.TYPING_UPDATE, {
      conversationId: String(conversationId),
      userId,
      name: socket.user.name,
      isTyping,
    });
  };

  socket.on(events.TYPING_START, ({ conversationId } = {}) => {
    if (!conversationId) return;
    broadcastTyping(conversationId, true);

    // Self-healing: a dropped "stop" event must not leave the dots spinning.
    const timeout = setTimeout(() => {
      presence.clearTyping(conversationId, userId);
      broadcastTyping(conversationId, false);
    }, TYPING_TIMEOUT_MS);

    presence.setTyping(conversationId, userId, timeout);
  });

  socket.on(events.TYPING_STOP, ({ conversationId } = {}) => {
    if (!conversationId) return;
    presence.clearTyping(conversationId, userId);
    broadcastTyping(conversationId, false);
  });

  // Delivery receipt: the recipient's client confirms it rendered the message.
  socket.on(events.MESSAGE_DELIVERED, async ({ messageId } = {}) => {
    if (!/^[a-f\d]{24}$/i.test(String(messageId || ''))) return;
    await Message.updateOne(
      { _id: messageId, 'readBy.user': { $ne: userId } },
      { $push: { readBy: { user: userId, at: new Date() } } }
    );
  });
}

module.exports = registerHandlers;
