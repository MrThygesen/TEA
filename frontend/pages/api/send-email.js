export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { name, email, message } = req.body
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TEA Network <hello@teanet.xyz>', // must be a verified sender
        to: 'defineers.hub@gmail.com',
        subject: `New contact form message from ${name}`,
        html: `
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong><br/>${message}</p>
        `,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(500).json({ error: 'Resend API failed', details: errText })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', details: err.message })
  }
}

