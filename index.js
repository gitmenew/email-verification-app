
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const rateLimit = require('express-rate-limit')

const app = express()
const PORT = process.env.PORT || 3000
const EMAIL_FILE = path.join(__dirname, 'ogas', 'oga.txt')

let validEmails = []
function loadEmails() {
  try {
    const data = fs.readFileSync(EMAIL_FILE, 'utf8')
    validEmails = data.split('\n').map(e => e.trim().toLowerCase())
    console.log('[INFO] Email list loaded into memory')
  } catch (err) {
    console.error('[ERROR] Failed to read email list:', err)
  }
}
loadEmails()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { valid: false, message: 'Too many requests, try again later.' },
})

app.use(cors())
app.use(express.json())
app.use(limiter)

// Local proxy handler to external protected API (kept server-side)
app.post('/api/check-email', async (req, res) => {
  try {
    const proxyRes = await fetch('https://email-verification-app-production-8ea5.up.railway.app/api/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await proxyRes.json()
    res.status(proxyRes.status).json(data)
  } catch (err) {
    console.error('[ERROR] Proxy failure:', err)
    res.status(500).json({ valid: false, message: 'Internal proxy error' })
  }
})

app.listen(PORT, () => {
  console.log(`Proxy-secured backend running on http://localhost:${PORT}`)
})
