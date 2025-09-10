// frontend/pages/api/confirm-email.js

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.redirect(302, "https://teanet.xyz?status=error&reason=missing");
  }

  try {
    // Call the backend bot/email.js endpoint
    const backendUrl = process.env.BOT_SERVER_URL || "https://tea-liart.vercel.app";
    const response = await fetch(`${backendUrl}/api/confirm-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || "Backend verification failed");
    }

    return res.redirect(302, "https://teanet.xyz?status=success");
  } catch (err) {
    console.error("Email verification failed:", err.message);
    return res.redirect(
      302,
      `https://teanet.xyz?status=error&reason=${encodeURIComponent(err.message)}`
    );
  }
}

