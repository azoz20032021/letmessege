'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const conversationRoutes = require('./conversation.routes');
const messageRoutes = require('./message.routes');
const uploadRoutes = require('./upload.routes');

const router = express.Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
  })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/uploads', uploadRoutes);

module.exports = router;
