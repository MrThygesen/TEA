// pages/dashboard.js
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { auth } from '../components/auth'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!auth.isLoggedIn()) {
      router.replace('/login')
      return
    }
    setUser(auth.getUser())
  }, [])

  if (!user) return <p className="text-white">Loading...</p>

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Welcome {user.username || user.email}</h1>
      <p>Email: {user.email}</p>
      <p>Tier: {user.tier}</p>
      <button
        onClick={() => {
          auth.logout()
          router.replace('/login')
        }}
        className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
      >
        Logout
      </button>
    </div>
  )
}





/*

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import auth from '../components/auth' // adjust path if different

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const tokenFromUrl = params.get('token')

    if (tokenFromUrl) {
      // Save token
      try {
        if (auth && typeof auth.setToken === 'function') {
          auth.setToken(tokenFromUrl)
        } else {
          localStorage.setItem('token', tokenFromUrl)
        }
      } catch (e) {
        console.error('Failed to save token', e)
      }

      // Clean URL
      router.replace('/dashboard')
      return
    }

    // No token in URL → check stored login
    let storedUser = null
    let storedToken = null
    try {
      if (auth && typeof auth.getUser === 'function') {
        storedUser = auth.getUser()
        storedToken = auth.getToken && auth.getToken()
      } else {
        storedToken = localStorage.getItem('token')
        const userStr = localStorage.getItem('user')
        storedUser = userStr ? JSON.parse(userStr) : null
      }
    } catch (err) {
      console.warn('Auth check failed', err)
    }

    if (storedToken) {
      setUser(storedUser)
      setLoading(false)
    } else {
      // Not logged in → go to login
      router.replace('/login')
    }
  }, [router])

  if (loading) {
    return <p style={{ margin: '2rem', fontSize: '1.2rem' }}>⏳ Loading dashboard...</p>
  }

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: '1rem' }}>Welcome to your Dashboard 🎉</h1>
      {user ? (
        <div>
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>
      ) : (
        <p>Could not load user info.</p>
      )}
    </div>
  )
}
*/ 
