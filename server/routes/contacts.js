const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const msgService = require('../services/msgService');

// All routes require auth
router.use(authMiddleware);

// GET /api/bots/:id/contacts — Get recent contacts
router.get('/:id/contacts', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const contacts = msgService.getContacts(botId, req.user.id);
    res.json({ success: true, data: contacts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
