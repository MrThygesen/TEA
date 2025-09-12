
// components/auth.js
export const auth = {
  isLoggedIn() {
    return !!localStorage.getItem('token')
  },
  getToken() {
    return localStorage.getItem('token')
  },
  getUser() {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  },
  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}


// components/auth.js
// Simple JWT auth helper

/*

const TOKEN_KEY = 'jwt'

export const auth = {
  // Save JWT token
  setToken: (token) => {
    if (!token) return
    localStorage.setItem(TOKEN_KEY, token)
  },

  // Get JWT token
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY)
  },

  // Remove JWT token (logout)
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
  },

  // Check if user is logged in
  isLoggedIn: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      // Optional: check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        auth.logout()
        return false
      }
      return true
    } catch (err) {
      auth.logout()
      return false
    }
  },

  // Helper for fetch with Authorization header
  fetchWithAuth: async (url, options = {}) => {
    const token = auth.getToken()
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    const res = await fetch(url, { ...options, headers })
    return res
  },
}
*/ 
