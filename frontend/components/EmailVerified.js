// components/EmailVerified.js 
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import auth from './auth'

export default function EmailVerified() {
  const router = useRouter()
  const { token } = router.query
  const [message, setMessage] = useState('⏳ Verifying your email...')

  useEffect(() => {
    if (!token) return

    async function verifyEmail() {
      try {
        const res = await fetch(`/api/confirm-email?token=${token}`)
        const data = await res.json()

        if (res.ok) {
          auth.setToken(data.token) // store JWT
          setMessage('✅ Email verified! Redirecting to your dashboard...')
          setTimeout(() => router.push('/dashboard'), 1500)
        } else {
          setMessage(`❌ Email verification failed: ${data.error}`)
        }
      } catch (err) {
        console.error(err)
        setMessage('❌ Email verification failed. Please try again.')
      }
    }

    verifyEmail()
  }, [token, router])

  return <p>{message}</p>
}

