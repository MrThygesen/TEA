export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dynamic imports so Next.js does not bundle Node-only modules
    const dotenv = await import('dotenv');
    const Brevo = await import('@getbrevo/brevo');

    dotenv.config();

    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    const { toEmail, subject, htmlContent } = req.body;

    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { name: 'TEA Project', email: process.env.BREVO_SENDER_EMAIL };

    const response = await client.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({ message: 'Email sent', response });
  } catch (err) {
    console.error('Email API error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}

