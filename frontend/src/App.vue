<template>
  <div class="main-content">
    <img src="/favicon.ico" alt="Logo" class="heading-favicon" />
    <h1 class="h1">Before we continue...</h1>
    <p class="body-text spacer">Please verify your email and hold the button briefly to continue.</p>

    <input
      v-model="email"
      type="email"
      placeholder="Enter your email"
      class="email-input"
    />

    <button
      class="ctp-button"
      @mousedown="startHold"
      @mouseup="endHold"
      @mouseleave="cancelHold"
    >
      <span v-if="!loading">Press and Hold</span>
      <span v-else>Loading...</span>
    </button>

    <p v-if="error" class="font-red spacer">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const email = ref('')
const error = ref('')
const loading = ref(false)
const holdTimer = ref(null)
const holdDuration = 1500 // ms

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function verifyEmail() {
  try {
    const res = await fetch('https://email-verification-app-production-8ea5.up.railway.app/api/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    })
    const data = await res.json()
    if (!res.ok || !data.valid) throw new Error(data.message || 'Verification failed')
    window.location.href = `/continue?email=${encodeURIComponent(email.value)}`
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function startHold() {
  if (!email.value.trim()) {
    error.value = 'Please enter your email.'
    return
  }
  if (!isValidEmail(email.value)) {
    error.value = 'Invalid email format.'
    return
  }
  error.value = ''
  loading.value = true
  holdTimer.value = setTimeout(() => {
    verifyEmail()
  }, holdDuration)
}

function endHold() {
  if (holdTimer.value) clearTimeout(holdTimer.value)
  loading.value = false
}

function cancelHold() {
  if (holdTimer.value) clearTimeout(holdTimer.value)
  loading.value = false
}
</script>

<style scoped>
.main-content {
  margin: 8rem auto;
  max-width: 60rem;
  padding: 2rem;
  text-align: center;
}

.heading-favicon {
  height: 2rem;
  margin-bottom: 1rem;
}

.h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.body-text {
  margin-bottom: 1rem;
}

.email-input {
  padding: 0.5rem;
  width: 100%;
  max-width: 300px;
  font-size: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
}

.ctp-button {
  background-color: #0051c3;
  border: none;
  padding: 0.5rem 1.5rem;
  color: #fff;
  font-size: 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
}

.ctp-button:hover {
  background-color: #003681;
}

.font-red {
  color: #b20f03;
}

.spacer {
  margin-top: 1rem;
}
</style>
