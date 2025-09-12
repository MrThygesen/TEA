'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token');
  const tgId = searchParams.get('tgId');

  const [message, setMessage] = useState('⏳ Verifying your email...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/confirm-email?token=${token}`);
        const data = await res.json();

        if (res.ok) {
          setMessage('✅ Email verified! Redirecting...');
          // Save JWT for auto-login (localStorage or cookie)
          localStorage.setItem('jwt', data.token);

          // Optional: save user info
          localStorage.setItem('user', JSON.stringify(data.user));

          // Redirect after 2 seconds
          setTimeout(() => {
            router.push('/dashboard'); // or '/' for homepage
          }, 2000);
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
  }, [token, router]);

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

