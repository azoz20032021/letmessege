'use strict';

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true, default: 'direct' },

    // Group-only metadata (ignored for direct conversations).
    name: { type: String, trim: true, maxlength: 60, default: '' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    avatar: { type: String, default: '' },
    isPrivate: { type: Boolean, default: true },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: Date.now, index: true },

    // userId -> timestamp of the last message that user has read.
    readState: {
      type: Map,
      of: Date,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret) => { delete ret.__v; return ret; } },
  }
);

conversationSchema.index({ members: 1, lastMessageAt: -1 });

/** Deterministic lookup/creation of the 1-to-1 room between two users. */
conversationSchema.statics.findOrCreateDirect = async function findOrCreateDirect(a, b) {
  const pair = [a, b].map(String).sort();
  const existing = await this.findOne({ type: 'direct', members: { $all: pair, $size: 2 } });
  if (existing) return existing;
  return this.create({ type: 'direct', members: pair, createdBy: a });
};

conversationSchema.methods.isMember = function isMember(userId) {
  return this.members.some((m) => String(m._id || m) === String(userId));
};

conversationSchema.methods.isAdmin = function isAdmin(userId) {
  return this.admins.some((m) => String(m._id || m) === String(userId));
};

module.exports = mongoose.model('Conversation', conversationSchema);
