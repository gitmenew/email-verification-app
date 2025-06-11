const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000
const CAPTCHA_SECRET = process.env.CLOUDFLARE_SECRET
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt')

// Load and cache email list
let validEmails = []
function loadEmailList() {
  try {
    const content = fs.readFileSync(EMAIL_FILE, 'utf8')
    validEmails = content.split('\n').map(e => e.trim().toLowerCase())
    console.log(`Loaded ${validEmails.length} emails.`)
  } catch (err) {
    console.error('Failed to read email file:', err)
  }
}
loadEmailList()

// Watch for changes to email file
fs.watchFile(EMAIL_FILE, () => {
  console.log('Email list updated.')
  loadEmailList()
})

// Rate Limiting (5 reqs/min/IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { valid: false, message: 'Too many requests, slow down' }
})

// Middleware
app.use(cors())
app.use(express.json())
app.use('/api/check-email', limiter)

// API Endpoint
app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken } = req.body

  if (!email) {
    console.warn(`⚠️ Missing email - IP: ${req.ip}`)
    return res.status(400).json({ valid: false, message: 'No email provided' })
  }

  if (!captchaToken) {
    console.warn(`⚠️ Missing CAPTCHA - Email: ${email} - IP: ${req.ip}`)
    return res.status(400).json({ valid: false, message: 'Captcha missing' })
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.warn(`⚠️ Invalid email format: ${email} - IP: ${req.ip}`)
    return res.status(400).json({ valid: false, message: 'Invalid email format' })
  }

  // CAPTCHA Verification
  try {
    const captchaRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${CAPTCHA_SECRET}&response=${captchaToken}`
    })

    const captchaData = await captchaRes.json()
    if (!captchaData.success) {
      console.warn(`❌ CAPTCHA failed for email ${email} - IP: ${req.ip}`)
      return res.status(400).json({ valid: false, message: 'Captcha failed. Please reload' })
    }
  } catch (err) {
    console.error('Captcha verification error:', err)
    return res.status(500).json({ valid: false, message: 'Captcha verification error' })
  }

  // Email lookup
  const isValid = validEmails.includes(email.toLowerCase())
  if (!isValid) {
    console.warn(`❌ Unauthorized email attempt: ${email} - IP: ${req.ip}`)
  }

  return res.json({
    valid: isValid,
    message: isValid ? 'Valid email' : 'Enter your recipient email to continue'
  })
})

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`)
})
