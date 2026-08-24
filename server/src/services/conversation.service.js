'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const POPULATE_MEMBERS = { path: 'members', select: User.PUBLIC_FIELDS };
const POPULATE_LAST = {
  path: 'lastMessage',
  populate: { path: 'sender', select: 'name avatar avatarColor' },
};

/** Counts messages in a conversation the given user has not read yet. */
async function unreadCountFor(conversation, userId) {
  const readState = conversation.readState instanceof Map
    ? conversation.readState
    : new Map(Object.entries(conversation.readState || {}));
  const since = readState.get(String(userId));

  return Message.countDocuments({
    conversation: conversation._id,
    sender: { $ne: userId },
    deletedAt: null,
    ...(since ? { createdAt: { $gt: since } } : {}),
  });
}

/** Serialises a conversation for the given viewer (adds unread + direct peer). */
async function serialize(conversation, userId) {
  const obj = conversation.toJSON ? conversation.toJSON() : conversation;
  const unreadCount = await unreadCountFor(conversation, userId);

  const peer =
    obj.type === 'direct'
      ? (obj.members || []).find((m) => String(m._id) !== String(userId)) || null
      : null;

  return {
    ...obj,
    readState: undefined,
    unreadCount,
    peer,
    title: obj.type === 'group' ? obj.name : peer?.name || 'Unknown',
  };
}

const serializeMany = (conversations, userId) =>
  Promise.all(conversations.map((c) => serialize(c, userId)));

/** Marks every message up to `at` as read for the user and returns the new count. */
async function markRead(conversation, userId, at = new Date()) {
  conversation.readState.set(String(userId), at);
  await conversation.save();

  await Message.updateMany(
    {
      conversation: conversation._id,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
    },
    { $push: { readBy: { user: userId, at } } }
  );
}

module.exports = {
  POPULATE_MEMBERS,
  POPULATE_LAST,
  unreadCountFor,
  serialize,
  serializeMany,
  markRead,
};
