'use strict';

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const events = require('../socket/events');
const { emitToConversation, emitToUsers } = require('../socket/io');
const { storeFile, deleteFile, isImage } = require('../utils/storage');
const { containsRegExp } = require('../utils/escapeRegExp');
const { loadMember } = require('./conversation.controller');
const { serialize } = require('../services/conversation.service');

const POPULATE_SENDER = { path: 'sender', select: 'name email avatar avatarColor isOnline' };
const POPULATE_REPLY = {
  path: 'replyTo',
  select: 'text type sender attachments createdAt',
  populate: { path: 'sender', select: 'name avatarColor' },
};

/**
 * Persists a message, refreshes the conversation preview and fans it out to
 * everyone in the room. Shared by the REST endpoint and the socket handler.
 */
async function createMessage({ conversation, sender, text = '', attachments = [], replyTo = null }) {
  const type = attachments.length
    ? attachments.every((a) => isImage(a.mimeType))
      ? 'image'
      : 'file'
    : 'text';

  let message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    type,
    text,
    attachments,
    replyTo: replyTo || null,
    // The sender has trivially read their own message.
    readBy: [{ user: sender._id, at: new Date() }],
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  conversation.readState.set(String(sender._id), message.createdAt);
  await conversation.save();

  message = await message.populate([POPULATE_SENDER, POPULATE_REPLY]);
  const payload = message.toJSON();

  emitToConversation(conversation._id, events.MESSAGE_NEW, {
    conversationId: String(conversation._id),
    message: payload,
  });

  // Also notify members who are online but do not have the room open, so their
  // sidebar preview and unread badge update immediately.
  const others = conversation.members
    .map((m) => String(m._id || m))
    .filter((id) => id !== String(sender._id));

  await Promise.all(
    others.map(async (userId) => {
      emitToUsers([userId], events.MESSAGE_DELIVERED, {
        conversationId: String(conversation._id),
        message: payload,
        conversation: await serialize(conversation, userId),
      });
    })
  );

  return payload;
}

// GET /api/conversations/:id/messages?limit=&before=
const listMessages = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  const { limit, before } = req.query;

  const filter = { conversation: conversation._id };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(filter)
    .populate(POPULATE_SENDER)
    .populate(POPULATE_REPLY)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  res.json({
    success: true,
    data: {
      messages: page.reverse(), // oldest → newest for direct rendering
      hasMore,
      nextCursor: hasMore ? page[0].createdAt : null,
    },
  });
});

// POST /api/conversations/:id/messages
const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  const { text, attachments, replyTo } = req.body;

  if (replyTo) {
    const parent = await Message.findOne({ _id: replyTo, conversation: conversation._id });
    if (!parent) throw ApiError.badRequest('Cannot reply to that message', { code: 'BAD_REPLY' });
  }

  const message = await createMessage({
    conversation,
    sender: req.user,
    text,
    attachments,
    replyTo,
  });

  res.status(201).json({ success: true, data: { message } });
});

// POST /api/conversations/:id/messages/upload — multipart, up to 5 files
const uploadAndSend = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files uploaded', { code: 'NO_FILES' });
  }

  const attachments = await Promise.all(
    req.files.map((file) => storeFile(file, { folder: 'letmessage/messages' }))
  );

  const message = await createMessage({
    conversation,
    sender: req.user,
    text: (req.body.text || '').trim(),
    attachments,
    replyTo: req.body.replyTo || null,
  });

  res.status(201).json({ success: true, data: { message } });
});

// PATCH /api/messages/:id
const editMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message || message.deletedAt) {
    throw ApiError.notFound('Message not found', { code: 'NO_MESSAGE' });
  }
  if (String(message.sender) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only edit your own messages', { code: 'NOT_SENDER' });
  }
  if (message.type !== 'text') {
    throw ApiError.badRequest('Only text messages can be edited', { code: 'NOT_TEXT' });
  }

  message.text = req.body.text;
  message.editedAt = new Date();
  await message.save();
  await message.populate([POPULATE_SENDER, POPULATE_REPLY]);

  const payload = message.toJSON();
  emitToConversation(message.conversation, events.MESSAGE_EDITED, {
    conversationId: String(message.conversation),
    message: payload,
  });

  res.json({ success: true, data: { message: payload } });
});

// DELETE /api/messages/:id — soft delete so the thread keeps its shape
const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message || message.deletedAt) {
    throw ApiError.notFound('Message not found', { code: 'NO_MESSAGE' });
  }

  const conversation = await Conversation.findById(message.conversation);
  const isSender = String(message.sender) === String(req.user._id);
  const isGroupAdmin = conversation?.type === 'group' && conversation.isAdmin(req.user._id);

  if (!isSender && !isGroupAdmin) {
    throw ApiError.forbidden('You cannot delete this message', { code: 'NOT_ALLOWED' });
  }

  // deleteFile never throws; it logs instead, so cleanup cannot fail the request.
  await Promise.all(message.attachments.map((a) => deleteFile(a.publicId)));

  message.deletedAt = new Date();
  message.text = '';
  message.attachments = [];
  await message.save();

  emitToConversation(message.conversation, events.MESSAGE_DELETED, {
    conversationId: String(message.conversation),
    messageId: String(message._id),
  });

  res.json({ success: true, data: { messageId: String(message._id) } });
});

// GET /api/messages/search?q=&conversationId=
const searchMessages = asyncHandler(async (req, res) => {
  const { q, limit, conversationId } = req.query;

  const conversationFilter = { members: req.user._id };
  if (conversationId) conversationFilter._id = new mongoose.Types.ObjectId(conversationId);

  const myConversations = await Conversation.find(conversationFilter).select('_id');
  if (myConversations.length === 0) {
    return res.json({ success: true, data: { results: [], count: 0 } });
  }

  const rx = containsRegExp(q);

  const results = await Message.find({
    conversation: { $in: myConversations.map((c) => c._id) },
    deletedAt: null,
    $or: [{ text: rx }, { 'attachments.name': rx }],
  })
    .populate(POPULATE_SENDER)
    .populate({
      path: 'conversation',
      select: 'type name members avatar',
      populate: { path: 'members', select: 'name avatar avatarColor' },
    })
    .sort({ createdAt: -1 })
    .limit(limit);

  return res.json({ success: true, data: { results, count: results.length } });
});

module.exports = {
  createMessage,
  listMessages,
  sendMessage,
  uploadAndSend,
  editMessage,
  deleteMessage,
  searchMessages,
  POPULATE_SENDER,
  POPULATE_REPLY,
};
