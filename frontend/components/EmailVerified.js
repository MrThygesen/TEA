//components/EmailVerified

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import auth from './auth' // your existing auth helper

export default function EmailVerified() {
  const router = useRouter()
  const [message, setMessage] = useState('⏳ Waiting for token...')
  const [isVerifying, setIsVerifying] = useState(false)
  const [token, setToken] = useState(null)

  // Extract token from multiple possible places (query, search, hash, pathname)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const byQuery = router?.query?.token
    if (byQuery) {
      setToken(Array.isArray(byQuery) ? byQuery[0] : byQuery)
      return
    }

    const searchParams = new URLSearchParams(window.location.search)
    const searchToken = searchParams.get('token')
    if (searchToken) {
      setToken(searchToken)
      return
    }

    // hash like #token=...
    if (window.location.hash) {
      const m = window.location.hash.match(/token=([^&]+)/)
      if (m && m[1]) {
        setToken(decodeURIComponent(m[1]))
        return
      }
    }

    // possible path style: /email-verified/<token>
    const pathMatch = window.location.pathname.match(/\/email-verified\/([^\/?#]+)/)
    if (pathMatch && pathMatch[1]) {
      setToken(decodeURIComponent(pathMatch[1]))
      return
    }

    setMessage('No token found in the URL. Paste it below or open the link from your email.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router?.query])

  // When token is present, call the API to confirm it
  useEffect(() => {
    if (!token) return
    if (isVerifying) return

    const verifyEmail = async () => {
      setIsVerifying(true)
      setMessage('⏳ Verifying your email...')

      try {
        const res = await fetch(`/api/confirm-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        const data = await res.json().catch(() => ({}))

        if (res.ok && data?.token) {
          // store JWT & user: prefer auth.setToken but fall back to localStorage
          if (auth && typeof auth.setToken === 'function') {
            try { auth.setToken(data.token, data.user) } catch (e) {
              console.warn('auth.setToken threw, falling back to localStorage', e)
              localStorage.setItem('token', data.token)
              if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
            }
          } else {
            localStorage.setItem('token', data.token)
            if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
          }

          setMessage('✅ Email verified! Redirecting to your dashboard…')
          // immediate replace to dashboard (cleans history)
          router.replace('/dashboard')
          return
        }

        // not OK
        const errMsg = data?.error || `Server returned ${res.status}`
        setMessage(`❌ Email verification failed: ${errMsg}`)
        console.warn('Email verification failure', { status: res.status, data })

      } catch (err) {
        console.error('Email verification request error', err)
        setMessage('❌ Email verification failed due to a network error. Try again.')
      } finally {
        setIsVerifying(false)
      }
    }

    verifyEmail()
  }, [token, isVerifying, router])

  return (
    <div style={{ maxWidth: 720, margin: '3rem auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginBottom: '.5rem' }}>Email verification</h2>
      <p style={{ marginBottom: '1rem' }}>{message}</p>

      {/* show controls when verification failed */}
      {!isVerifying && token && message.startsWith('❌') && (
        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
          <button
            onClick={() => {
              setMessage('⏳ Retrying...')
              // retrigger verification by toggling token briefly
              setIsVerifying(false)
              setTimeout(() => setToken(token), 50)
            }}
          >
            Try again
          </button>
          <button onClick={() => router.push('/login')}>Go to login</button>
        </div>
      )}

      {/* allow manual paste if no token found */}
      {!token && (
        <div style={{ marginTop: '1rem' }}>
          <TokenPaste onSubmit={(t) => setToken(t)} />
        </div>
      )}
    </div>
  )
}

// small helper component for manual token paste
function TokenPaste({ onSubmit }) {
  const [val, setVal] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!val) return
        onSubmit(val.trim())
      }}
      style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}
    >
      <input
        aria-label="verification token"
        placeholder="Paste verification token here"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        style={{ flex: 1, padding: '.5rem' }}
      />
      <button type="submit">Verify</button>
    </form>
  )
}

