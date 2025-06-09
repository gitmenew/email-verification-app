const express = require('express')
const cors = require('cors')
const app = express()

const PORT = process.env.PORT || 3000

// Dummy list of valid emails
const validEmails = ['test@example.com', 'demo@site.com', 'john@domain.com']

app.use(cors())
app.use(express.json())

app.post('/api/check-email', (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ valid: false, message: 'No email provided' })
  }

  const isValid = validEmails.includes(email.toLowerCase())
  return res.json({ valid: isValid, message: isValid ? 'Valid email' : 'Email not recognized' })
})

app.listen(PORT, () => {
  console.log(`Email verification backend running on http://localhost:${PORT}`)
})
