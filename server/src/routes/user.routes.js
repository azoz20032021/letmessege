'use strict';

const express = require('express');
const ctrl = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { protect, blockDemoMutation } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const { updateProfileSchema } = require('../validators/schemas');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listUsers);
router.get('/online', ctrl.onlineUsers);
router.patch('/me', validate(updateProfileSchema), ctrl.updateProfile);
router.post(
  '/me/avatar',
  blockDemoMutation,
  uploadLimiter,
  upload.single('avatar'),
  ctrl.updateAvatar
);
router.get('/:id', ctrl.getUser);

module.exports = router;
