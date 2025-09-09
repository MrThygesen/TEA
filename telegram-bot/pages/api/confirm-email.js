// tea-project/telegram-bot/pages/api/confirm-email.js
import express from "express";
import { confirmEmailToken } from "../../email.js";

const app = express();
app.use(express.json());

app.post("/api/confirm-email", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).send("Missing token");

  try {
    const result = await confirmEmailToken(token);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
});

export default app;

