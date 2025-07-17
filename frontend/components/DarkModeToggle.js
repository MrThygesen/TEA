'use client'
import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const root = window.document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [dark])

  return (
    <button
      className="p-2 m-2 rounded border"
      onClick={() => setDark(!dark)}
    >
      Toggle {dark ? 'Light' : 'Dark'} Mode
    </button>
  )
}

