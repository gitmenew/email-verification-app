const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const app = express()

const PORT = process.env.PORT || 3000
const EMAIL_FILE = path.join(__dirname, 'emails.txt')

app.use(cors())
app.use(express.json())

app.post('/api/check-email', (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ valid: false, message: 'No email provided' })
  }

  fs.readFile(EMAIL_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading email file:', err)
      return res.status(500).json({ valid: false, message: 'Internal server error' })
    }

    const validEmails = data.split('\n').map(e => e.trim().toLowerCase())
    const isValid = validEmails.includes(email.toLowerCase())
    res.json({ valid: isValid, message: isValid ? 'Valid email' : 'Please enter your work email address for verification' })
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
