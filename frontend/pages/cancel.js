//frontend/pages/cancel.js

export default function CancelPage() {
  const eventId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('event')
    : null;

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>❌ Payment Canceled</h1>
      <p>Your payment was not completed.</p>
      {eventId && <p>You can retry the payment for event ID <strong>{eventId}</strong>.</p>}
    </div>
  );
}

