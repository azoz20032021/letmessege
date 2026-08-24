'use strict';

const express = require('express');
const ctrl = require('../controllers/conversation.controller');
const messageCtrl = require('../controllers/message.controller');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const {
  createConversationSchema,
  updateGroupSchema,
  membersSchema,
  sendMessageSchema,
  paginationSchema,
} = require('../validators/schemas');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listConversations);
router.post('/', validate(createConversationSchema), ctrl.createConversation);

router.get('/:id', ctrl.getConversation);
router.patch('/:id', validate(updateGroupSchema), ctrl.updateGroup);
router.post('/:id/read', ctrl.markConversationRead);

router.post('/:id/members', validate(membersSchema), ctrl.addMembers);
router.delete('/:id/members/:userId', ctrl.removeMember);

router.get('/:id/messages', validate(paginationSchema, 'query'), messageCtrl.listMessages);
router.post('/:id/messages', validate(sendMessageSchema), messageCtrl.sendMessage);
router.post(
  '/:id/messages/upload',
  uploadLimiter,
  upload.array('files', 5),
  messageCtrl.uploadAndSend
);

module.exports = router;
