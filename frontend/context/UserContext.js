// context/UserContext.js
'use client' // optional for Next.js 13+ app folder, safe in pages router

import { createContext, useState, useEffect } from 'react'

export const UserContext = createContext({ user: null, setUser: () => {} })

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)

  // Load user from localStorage on initial render
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

