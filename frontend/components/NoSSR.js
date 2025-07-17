// components/NoSSR.js
'use client'
import { useEffect, useState } from 'react'

export default function NoSSR({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null      // nothing during SSR
}

