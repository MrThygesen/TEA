// pages/email-verified.js
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function EmailVerified() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    if (!token) return

    const verify = async () => {
      try {
        const res = await fetch(`/api/confirm-email?token=${token}`)
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Verification failed')

        // ✅ Store token + user in localStorage
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))

        setStatus('success')

        // Redirect to dashboard after short delay
        setTimeout(() => router.replace('/dashboard'), 2000)
      } catch (err) {
        console.error('Email verification failed:', err)
        setStatus('error')
      }
    }

    verify()
  }, [token, router])

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-900 text-white">
      <div className="text-center">
        {status === 'loading' && (
          <h1 className="text-xl">⏳ Verifying your email...</h1>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold mb-4">🎉 Email Verified</h1>
            <p className="mb-4">You are being logged in automatically...</p>
          </>
        )}
        {status === 'error' && (
          <h1 className="text-xl text-red-400">❌ Invalid or expired link.</h1>
        )}
      </div>
    </div>
  )
}

