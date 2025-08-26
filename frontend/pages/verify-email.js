// pages/verify-email.js
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const tgId = searchParams.get('tgId');
  const token = searchParams.get('token');

  const [message, setMessage] = useState('⏳ Verifying your email...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tgId || !token) return;

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/verify-email?tgId=${tgId}&token=${token}`);
        const data = await res.json();

        if (res.ok) {
          setMessage(data.message || '✅ Email verified successfully!');
        } else {
          setMessage(`❌ ${data.error || 'Verification failed'}`);
        }
      } catch (err) {
        console.error(err);
        setMessage('⚠️ Server error, please try again later.');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [tgId, token]);

  return (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '500px',
      margin: '3rem auto',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h1>Email Verification</h1>
      <p>{loading ? '⏳ Please wait...' : message}</p>
    </div>
  );
}

