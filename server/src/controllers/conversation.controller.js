'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const events = require('../socket/events');
const { emitToUsers, emitToConversation } = require('../socket/io');
const {
  POPULATE_MEMBERS,
  POPULATE_LAST,
  serialize,
  serializeMany,
  markRead,
} = require('../services/conversation.service');

/** Loads a conversation and asserts the caller is a member of it. */
async function loadMember(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId)
    .populate(POPULATE_MEMBERS)
    .populate(POPULATE_LAST);
  if (!conversation) throw ApiError.notFound('Conversation not found', { code: 'NO_CONVERSATION' });
  if (!conversation.isMember(userId)) {
    throw ApiError.forbidden('You are not a member of this conversation', { code: 'NOT_MEMBER' });
  }
  return conversation;
}

// GET /api/conversations
const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ members: req.user._id })
    .populate(POPULATE_MEMBERS)
    .populate(POPULATE_LAST)
    .sort({ lastMessageAt: -1 })
    .limit(100);

  res.json({
    success: true,
    data: { conversations: await serializeMany(conversations, req.user._id) },
  });
});

// POST /api/conversations
const createConversation = asyncHandler(async (req, res) => {
  const { type, memberIds, name, description } = req.body;
  const me = String(req.user._id);

  const uniqueIds = [...new Set(memberIds.map(String))].filter((id) => id !== me);
  if (uniqueIds.length === 0) {
    throw ApiError.badRequest('Pick at least one other member', { code: 'NO_MEMBERS' });
  }

  const found = await User.countDocuments({ _id: { $in: uniqueIds } });
  if (found !== uniqueIds.length) {
    throw ApiError.badRequest('One or more members do not exist', { code: 'BAD_MEMBERS' });
  }

  let conversation;
  let created = true;

  if (type === 'direct') {
    const existing = await Conversation.findOne({
      type: 'direct',
      members: { $all: [me, uniqueIds[0]], $size: 2 },
    });
    if (existing) {
      conversation = existing;
      created = false;
    } else {
      conversation = await Conversation.create({
        type: 'direct',
        members: [me, uniqueIds[0]],
        createdBy: me,
      });
    }
  } else {
    conversation = await Conversation.create({
      type: 'group',
      name,
      description: description || '',
      members: [me, ...uniqueIds],
      admins: [me],
      createdBy: me,
    });

    await Message.create({
      conversation: conversation._id,
      sender: me,
      type: 'system',
      text: `${req.user.name} created the group`,
    });
  }

  await conversation.populate(POPULATE_MEMBERS);
  await conversation.populate(POPULATE_LAST);
  const payload = await serialize(conversation, req.user._id);

  if (created) {
    emitToUsers(
      conversation.members.map((m) => m._id),
      events.CONVERSATION_CREATED,
      { conversation: payload }
    );
  }

  res.status(created ? 201 : 200).json({ success: true, data: { conversation: payload } });
});

// GET /api/conversations/:id
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  res.json({
    success: true,
    data: { conversation: await serialize(conversation, req.user._id) },
  });
});

// PATCH /api/conversations/:id
const updateGroup = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  if (conversation.type !== 'group') {
    throw ApiError.badRequest('Only groups can be edited', { code: 'NOT_GROUP' });
  }
  if (!conversation.isAdmin(req.user._id)) {
    throw ApiError.forbidden('Only group admins can edit the group', { code: 'NOT_ADMIN' });
  }

  Object.assign(conversation, req.body);
  await conversation.save();

  const payload = await serialize(conversation, req.user._id);
  emitToConversation(conversation._id, events.CONVERSATION_UPDATED, { conversation: payload });

  res.json({ success: true, data: { conversation: payload } });
});

// POST /api/conversations/:id/members
const addMembers = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  if (conversation.type !== 'group') {
    throw ApiError.badRequest('Only groups accept new members', { code: 'NOT_GROUP' });
  }
  if (!conversation.isAdmin(req.user._id)) {
    throw ApiError.forbidden('Only group admins can add members', { code: 'NOT_ADMIN' });
  }

  const current = conversation.members.map((m) => String(m._id));
  const toAdd = [...new Set(req.body.memberIds.map(String))].filter((id) => !current.includes(id));
  if (toAdd.length === 0) {
    throw ApiError.badRequest('Those users are already members', { code: 'ALREADY_MEMBERS' });
  }

  const added = await User.find({ _id: { $in: toAdd } }).select('name');
  if (added.length !== toAdd.length) {
    throw ApiError.badRequest('One or more members do not exist', { code: 'BAD_MEMBERS' });
  }

  conversation.members.push(...toAdd);
  await conversation.save();

  await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    type: 'system',
    text: `${req.user.name} added ${added.map((u) => u.name).join(', ')}`,
  });

  await conversation.populate(POPULATE_MEMBERS);
  const payload = await serialize(conversation, req.user._id);
  emitToUsers(conversation.members.map((m) => m._id), events.CONVERSATION_UPDATED, {
    conversation: payload,
  });

  res.json({ success: true, data: { conversation: payload } });
});

// DELETE /api/conversations/:id/members/:userId
const removeMember = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  const target = String(req.params.userId);
  const me = String(req.user._id);

  if (conversation.type !== 'group') {
    throw ApiError.badRequest('Only groups have removable members', { code: 'NOT_GROUP' });
  }
  if (target !== me && !conversation.isAdmin(me)) {
    throw ApiError.forbidden('Only group admins can remove members', { code: 'NOT_ADMIN' });
  }
  if (!conversation.isMember(target)) {
    throw ApiError.notFound('That user is not a member', { code: 'NOT_MEMBER' });
  }

  const targetName =
    target === me ? req.user.name : (await User.findById(target).select('name'))?.name;

  conversation.members = conversation.members.filter((m) => String(m._id) !== target);
  conversation.admins = conversation.admins.filter((m) => String(m._id || m) !== target);

  // Last member out deletes the group along with its history.
  if (conversation.members.length === 0) {
    await Message.deleteMany({ conversation: conversation._id });
    await conversation.deleteOne();
    return res.json({ success: true, data: { deleted: true } });
  }

  // Never leave a group without an admin.
  if (conversation.admins.length === 0) conversation.admins.push(conversation.members[0]._id);
  await conversation.save();

  await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    type: 'system',
    text: target === me ? `${targetName} left the group` : `${req.user.name} removed ${targetName}`,
  });

  await conversation.populate(POPULATE_MEMBERS);
  const payload = await serialize(conversation, req.user._id);
  emitToUsers([...conversation.members.map((m) => m._id), target], events.CONVERSATION_UPDATED, {
    conversation: payload,
    removedUserId: target,
  });

  return res.json({ success: true, data: { conversation: payload } });
});

// POST /api/conversations/:id/read
const markConversationRead = asyncHandler(async (req, res) => {
  const conversation = await loadMember(req.params.id, req.user._id);
  const at = new Date();
  await markRead(conversation, req.user._id, at);

  emitToConversation(conversation._id, events.MESSAGE_READ, {
    conversationId: String(conversation._id),
    userId: String(req.user._id),
    at,
  });

  res.json({ success: true, data: { conversationId: String(conversation._id), unreadCount: 0 } });
});

module.exports = {
  loadMember,
  listConversations,
  createConversation,
  getConversation,
  updateGroup,
  addMembers,
  removeMember,
  markConversationRead,
};
