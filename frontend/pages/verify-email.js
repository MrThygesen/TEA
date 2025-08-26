'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function VerifyEmail() {
  const router = useRouter();
  const { tgId, token } = router.query;
  const [message, setMessage] = useState('Verifying your email...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tgId || !token) return;

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/verify-email?tgId=${tgId}&token=${token}`);
        const text = await res.text();

        if (res.ok) {
          setMessage(text);
        } else {
          setMessage(`❌ ${text}`);
        }
      } catch (err) {
        setMessage('⚠️ Server error, please try again later.');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [tgId, token]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>Email Verification</h1>
      {loading ? <p>⏳ Please wait...</p> : <p>{message}</p>}
    </div>
  );
}

