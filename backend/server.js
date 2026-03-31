import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/scan", async (req, res) => {
  const { sender, subject, body } = req.body;

  console.log("📩 Received email:", sender);

  // 🔥 TEMP FAKE AI (for testing)
  let risk = Math.floor(Math.random() * 100);

  res.json({
    risk,
    reason: "Demo AI result"
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});