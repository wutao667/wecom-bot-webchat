const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.register(username, password);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
