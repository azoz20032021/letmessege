'use strict';

const express = require('express');
const ctrl = require('../controllers/upload.controller');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', protect, uploadLimiter, upload.array('files', 5), ctrl.uploadFiles);

module.exports = router;
