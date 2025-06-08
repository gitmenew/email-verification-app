const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

const validEmails = ['test@example.com', 'admin@site.com', 'user@domain.com']

app.post('/api/check-email', (req, res) => {
  const { email } = req.body
  if (validEmails.includes(email.toLowerCase())) {
    return res.json({ valid: true })
  }
  res.status(403).json({ valid: false, message: 'Email not authorized' })
})

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
