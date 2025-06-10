require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const rateLimit = require('express-rate-limit')

const app = express()
const PORT = process.env.PORT || 3000
const EMAIL_FILE = path.join(__dirname, 'emails.txt')

// Middleware
app.use(cors())
app.use(express.json())

// Rate limiting: 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { valid: false, message: 'Too many requests. Please try again later.' }
})
app.use(limiter)

// Endpoint
app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken } = req.body
  const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  console.log(`[IP: ${userIP}] Checking email: ${email}`)

  if (!email) {
    return res.status(400).json({ valid: false, message: 'No email provided' })
  }
  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' })
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.CLOUDFLARE_SECRET}&response=${captchaToken}`
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.success) {
      return res.status(400).json({ valid: false, message: 'Captcha failed. Please reload' })
    }
  } catch (err) {
    console.error('Captcha verification error:', err)
    return res.status(500).json({ valid: false, message: 'Captcha verification error' })
  }

  fs.readFile(EMAIL_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading email file:', err)
      return res.status(500).json({ valid: false, message: 'Internal server error' })
    }

    const validEmails = data.split('\n').map(e => e.trim().toLowerCase())
    const isValid = validEmails.includes(email.toLowerCase())
    res.json({
      valid: isValid,
      message: isValid ? 'Valid email' : 'Enter your recipient email to continue'
    })
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
