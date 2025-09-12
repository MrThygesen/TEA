// pages/api/login.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  const { email, password } = req.body || {}
  console.log("📩 API received:", { email, password })

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }

  return res.status(200).json({ message: "Login success", email })
}

