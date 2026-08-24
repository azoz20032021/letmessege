'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  locale: z.enum(['en', 'ar', 'tr']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),
    bio: z.string().trim().max(160).optional(),
    locale: z.enum(['en', 'ar', 'tr']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const createConversationSchema = z
  .object({
    type: z.enum(['direct', 'group']),
    memberIds: z.array(objectId).min(1, 'Pick at least one member'),
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'group' && !v.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Group name is required' });
    }
    if (v.type === 'direct' && v.memberIds.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['memberIds'],
        message: 'A direct conversation needs exactly one other member',
      });
    }
  });

const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const membersSchema = z.object({
  memberIds: z.array(objectId).min(1, 'Pick at least one member'),
});

const sendMessageSchema = z
  .object({
    text: z.string().trim().max(4000).optional().default(''),
    attachments: z
      .array(
        z.object({
          url: z.string().min(1),
          publicId: z.string().optional().default(''),
          name: z.string().optional().default(''),
          mimeType: z.string().optional().default(''),
          size: z.number().nonnegative().optional().default(0),
          width: z.number().optional(),
          height: z.number().optional(),
        })
      )
      .max(5)
      .optional()
      .default([]),
    replyTo: objectId.nullish(),
  })
  .refine((v) => v.text.length > 0 || v.attachments.length > 0, {
    message: 'A message needs text or at least one attachment',
    path: ['text'],
  });

const editMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  before: z.string().datetime().optional(),
  cursor: objectId.optional(),
});

const searchSchema = z.object({
  q: z.string().trim().min(1, 'Search term is required').max(100),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  conversationId: objectId.optional(),
});

module.exports = {
  objectId,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createConversationSchema,
  updateGroupSchema,
  membersSchema,
  sendMessageSchema,
  editMessageSchema,
  paginationSchema,
  searchSchema,
};
