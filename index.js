require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
// const rateLimit = require('express-rate-limit'); // Temporarily disabled

const app = express();
const PORT = process.env.PORT || 3000;
const EXTERNAL_API = process.env.EXTERNAL_API;
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

// Rate limiting temporarily disabled
// const limiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 400,
//   message: { valid: false, message: 'Too many requests, try again later.' },
// });

app.use(cors());
app.use(express.json());
// app.use(limiter); // Commented out for now

// Local proxy handler to external protected API (kept server-side)
// Direct local email verification (no external proxy)
app.post('/api/check-email', (req, res) => {
  const { email, captchaToken } = req.body

  // Basic input checks
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ valid: false, message: 'Email is required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const found = validEmails.includes(normalizedEmail)

  if (!found) {
    return res.status(404).json({ valid: false, message: 'Email not found' })
  }

  // Optional: validate captchaToken here if needed
  // If using Cloudflare Turnstile, you can add verification later

  res.json({ valid: true, message: 'Email verified' })
})



app.listen(PORT, () => {
  console.log(`Proxy-secured backend running on http://localhost:${PORT}`);
});
