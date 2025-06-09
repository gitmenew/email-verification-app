const fetch = require('node-fetch'); // Add at the top if not already

app.post('/api/check-email', async (req, res) => {
  const { email, captchaToken } = req.body
  if (!captchaToken) {
    return res.status(400).json({ valid: false, message: 'Captcha missing' })
  }

  // Verify with Cloudflare
  const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=0x4AAAAAABgei31cPHEZ22nHMf0iiF4ScF8&response=${captchaToken}`
  });
  const cfData = await cfRes.json();
  if (!cfData.success) {
    return res.status(400).json({ valid: false, message: 'Captcha verification failed' });
  }

  // ...existing email check logic below...
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
