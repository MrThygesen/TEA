// components/EmailVerified.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import auth from '../lib/auth'

export default function EmailVerified() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!token) return

    async function verifyEmail() {
      try {
        const res = await fetch(`/api/confirm-email?token=${token}`)
        const data = await res.json()

        if (res.ok) {
          auth.setToken(data.token) // store JWT
          setStatus('success')
          router.push('/dashboard') // auto redirect
        } else {
          setStatus('error')
          console.error(data.error)
        }
      } catch (err) {
        console.error(err)
        setStatus('error')
      }
    }

    verifyEmail()
  }, [token, router])

  if (status === 'loading') return <p>⏳ Verifying your email...</p>
  if (status === 'error') return <p>❌ Email verification failed.</p>

  return <p>✅ Email verified! Redirecting...</p>
}

