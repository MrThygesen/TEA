// tea-project/frontend/pages/api/verify-email.js
import { confirmEmailToken } from "../../../shared/email.js";

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.redirect(302, "https://teanet.xyz?status=error&reason=missing");
  }

  try {
    // Use shared/email.js function to validate token and update user
    const result = await confirmEmailToken(token);

    console.log("Email verified for:", result);
    return res.redirect(302, "https://teanet.xyz?status=success");
  } catch (err) {
    console.error("Email verification failed:", err.message);
    return res.redirect(302, `https://teanet.xyz?status=error&reason=${encodeURIComponent(err.message)}`);
  }
}

