'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Colour *keys*, not CSS classes: the client owns how each one is painted.
// Storing class names here would break the moment Tailwind stopped generating
// them, since its scanner cannot see strings that live in the database.
const AVATAR_COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'cyan'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: { type: String, default: '' },
    avatarPublicId: { type: String, default: '' },
    avatarColor: {
      type: String,
      enum: AVATAR_COLORS,
      default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
    bio: { type: String, default: '', maxlength: 160, trim: true },
    locale: { type: String, enum: ['en', 'ar', 'tr'], default: 'en' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.avatarPublicId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Text index powers the "search people" box.
userSchema.index({ name: 'text', email: 'text' });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Shape safe to broadcast over sockets / embed in API payloads. */
userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    avatarColor: this.avatarColor,
    bio: this.bio,
    locale: this.locale,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

userSchema.statics.PUBLIC_FIELDS = 'name email avatar avatarColor bio isOnline lastSeen';

module.exports = mongoose.model('User', userSchema);
module.exports.AVATAR_COLORS = AVATAR_COLORS;
