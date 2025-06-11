require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit'); // ✅ Re-enabled

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt');

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

// ✅ Re-enabled rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 400,            // limit each IP to 400 requests per windowMs
  message: { valid: false, message: 'Too many requests, try again later.' },
});

app.use(cors());
app.use(express.json());
app.use(limiter); // ✅ Active now

// Internal email validation logic (no proxy)
app.post('/api/check-email', (req, res) => {
  const { email, captchaToken } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ valid: false, message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const found = validEmails.includes(normalizedEmail);

  if (!found) {
    return res.status(404).json({ valid: false, message: 'Email not found' });
  }

  // Optional: validate captchaToken here if needed
  res.json({ valid: true, message: 'Email verified' });
});

app.listen(PORT, () => {
  console.log(`Proxy-secured backend running on http://localhost:${PORT}`);
});
