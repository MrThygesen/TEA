// lib/auth.js
import jwt from 'jsonwebtoken'

const TOKEN_KEY = process.env.JWT_SECRET || 'dev_secret'

export const auth = {
  getTokenFromReq: (req) => {
    const authHeader = req.headers.authorization
    if (!authHeader) return null
    const [scheme, token] = authHeader.split(' ')
    if (scheme !== 'Bearer') return null
    return token
  },

  verifyToken: (token) => {
    return jwt.verify(token, TOKEN_KEY) // returns user payload
  },
}

