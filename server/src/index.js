import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { User, Lead, Note, Activity } from "./models/index.js";

dotenv.config();

const app = express();

// Middleware order: security headers, CORS, body parsing, cookie parsing
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

// TODO(Phase 8): remove before submission. For now DoD Phase 
app.get("/api/_debug/models", async (req, res) => {
  try {
    const user = await User.findOne({ email: "admin@crm.local" });
    const lead = await Lead.findOne({ name: "Thandi Mokoena" });
    res.json({ user, lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test" && process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("Mongo connected");
      app.listen(PORT, () => console.log(`API on ${PORT}`));
    })
    .catch((err) => console.error("Mongo error:", err.message));
}

export default app;
