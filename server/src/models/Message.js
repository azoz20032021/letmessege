'use strict';

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    name: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    attachments: { type: [attachmentSchema], default: [] },

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    readBy: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],

    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret) => { delete ret.__v; return ret; } },
  }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ text: 'text' });

messageSchema.methods.isReadBy = function isReadBy(userId) {
  return this.readBy.some((r) => String(r.user) === String(userId));
};

module.exports = mongoose.model('Message', messageSchema);
