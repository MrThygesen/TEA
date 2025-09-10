import { verifyJwt } from '../../lib/verifyJwt'

export default async function handler(req, res) {
  try {
    const user = verifyJwt(req) // { id, email, username }
    // now you can safely fetch DB data only for that user
  } catch (err) {
    return res.status(401).json({ error: err.message })
  }
}

