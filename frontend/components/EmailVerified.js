// components/EmailVerified.js
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import auth from '../lib/auth'

export default function EmailVerified() {
  const router = useRouter()
  const { status, token } = router.query
  const [message, setMessage] = useState('⏳ Verifying your email...')

  useEffect(() => {
    if (!status) return

    if (status === 'success' && token) {
      // Store JWT and redirect
      auth.setToken(token)
      setMessage('✅ Email verified! Redirecting to your dashboard...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } else if (status === 'error') {
      setMessage('❌ Email verification failed. The token may be invalid or expired.')
    }
  }, [status, token, router])

  return <p>{message}</p>
}

