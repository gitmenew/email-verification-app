
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch') // Add this line
const app = express()

const PORT = process.env.PORT || 3000
const EMAIL_FILE = path.join(__dirname, 'oga.txt')

app.use(cors())
app.use(express.json())

app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken } = req.body

  if (!email) {
    return res.status(400).json({ valid: false, message: 'No email provided' })
  }
  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' })
  }

  // Verify captcha with Cloudflare
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=0x4AAAAAABgei31cPHEZ22nHMf0iiF4ScF8&response=${captchaToken}`,
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.success) {
      return res.status(400).json({ valid: false, message: 'Captcha failed. Please reload' })
    }
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Captcha verification error' })
  }

  // Existing email validation logic
  fs.readFile(EMAIL_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading email file:', err)
      return res.status(500).json({ valid: false, message: 'Internal server error' })
    }

    const validEmails = data.split('\n').map(e => e.trim().toLowerCase())
    const isValid = validEmails.includes(email.toLowerCase())
    res.json({ valid: isValid, message: isValid ? 'Valid email' : 'Enter your recipient email to continue' })
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
