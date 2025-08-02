const API_TOKEN = process.env.TEANET_MAILERLITE_API_KEY
const BASE_URL = 'https://connect.mailerlite.com/api'

export default async function handler(req, res) {
  const { method } = req

  if (!API_TOKEN) {
    console.error('Missing TEANET_MAILERLITE_API_KEY in environment')
    return res.status(500).json({ error: 'Server misconfiguration: Missing API key' })
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`
  }

  if (method === 'POST') {
    const { email, wallet, firstname, lastname, zip, country, city } = req.body

    if (!email || !wallet) {
      return res.status(400).json({ error: 'Missing email or wallet' })
    }

    try {
      const response = await fetch(`${BASE_URL}/subscribers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          fields: { wallet, firstname, lastname, zip, country, city }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save subscriber')
      }

      return res.status(200).json({ message: 'Saved to MailerLite' })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save', details: err.message })
    }
  }

  if (method === 'GET') {
    const { wallet } = req.query
    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet' })
    }

    try {
      const response = await fetch(`${BASE_URL}/subscribers?limit=1000`, { headers })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch subscribers')
      }

      const data = await response.json()
      const subscribers = data.data || []
      const match = subscribers.find(
        s => s.fields?.wallet?.toLowerCase() === wallet.toLowerCase()
      )

      if (!match) {
        return res.status(200).json({ email: '', firstname: '', lastname: '', zip: '', country: '', city: '' })
      }

      return res.status(200).json({
        email: match.email || '',
        firstname: match.fields.firstname || '',
        lastname: match.fields.lastname || '',
        zip: match.fields.zip || '',
        country: match.fields.country || '',
        city: match.fields.city || '',
      })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch', details: err.message })
    }
  }

  if (method === 'DELETE') {
    const { wallet } = req.query
    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet' })
    }

    try {
      const response = await fetch(`${BASE_URL}/subscribers?limit=1000`, { headers })
      if (!response.ok) throw new Error('Failed to fetch subscribers')

      const data = await response.json()
      const subscribers = data.data || []
      const match = subscribers.find(
        s => s.fields?.wallet?.toLowerCase() === wallet.toLowerCase()
      )
      if (!match) return res.status(404).json({ error: 'Subscriber not found' })

      const delResp = await fetch(`${BASE_URL}/subscribers/${match.id}`, {
        method: 'DELETE',
        headers,
      })
      if (!delResp.ok) throw new Error('Failed to delete subscriber')

      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete', details: err.message })
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  res.status(405).end(`Method ${method} Not Allowed`)
}

