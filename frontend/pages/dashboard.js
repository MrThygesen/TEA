// pages/dashboard.js
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import UserDashboard from '../components/UserDashboard'
import auth from '../components/auth'

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = auth?.getToken?.() || localStorage.getItem('token')
    const storedUser = auth?.getUser?.() || localStorage.getItem('user')

    if (!token) {
      router.replace('/login')
      return
    }

    try {
      setUser(typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser)
    } catch {
      setUser(storedUser)
    }

    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return <p style={{ margin: '2rem', textAlign: 'center' }}>⏳ Loading dashboard...</p>
  }

  return <UserDashboard user={user} />
}

