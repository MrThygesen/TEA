// pages/login.js
'use client'

import { useState } from 'react'
import LoginModal from '../components/loginModal'

export default function LoginPage() {
  const [open, setOpen] = useState(true)

  return (
    <div>
      {open && (
        <LoginModal
          onClose={() => setOpen(false)}
          onLoginSuccess={(data) => {
            console.log("✅ Logged in:", data)
          }}
        />
      )}
    </div>
  )
}

