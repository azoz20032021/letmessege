'use strict';

const express = require('express');
const ctrl = require('../controllers/message.controller');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { editMessageSchema, searchSchema } = require('../validators/schemas');

const router = express.Router();

router.use(protect);

router.get('/search', validate(searchSchema, 'query'), ctrl.searchMessages);
router.patch('/:id', validate(editMessageSchema), ctrl.editMessage);
router.delete('/:id', ctrl.deleteMessage);

module.exports = router;
