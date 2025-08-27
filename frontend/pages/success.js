//frontend/pages/success.js

export default function SuccessPage({ query }) {
  const eventId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('event')
    : null;

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>✅ Payment Successful</h1>
      <p>Thank you for your payment!</p>
      {eventId && <p>Your ticket for event ID <strong>{eventId}</strong> is confirmed.</p>}
      <p>Go back to Telegram to check your ticket with <code>/ticket</code>.</p>
    </div>
  );
}

