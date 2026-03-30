import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// THIS FIXES YOUR ERROR
app.post("/api/session/start", (_req, res) => {
  res.json({
    success: true,
    message: "JARVIS started successfully 🚀",
  });
});

export default app;