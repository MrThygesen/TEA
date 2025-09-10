import jwt from 'jsonwebtoken'

export function verifyJwt(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.split(' ')[1]
  try {
    return jwt.verify(token, process.env.JWT_SECRET) // returns { id, email, username }
  } catch (err) {
    throw new Error('Invalid or expired token')
  }
}

