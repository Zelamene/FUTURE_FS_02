import express from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pathToFileURL } from "node:url";
import { User, Lead } from "./models/index.js";
import authRouter from "./routes/auth.js";
import leadsRouter from "./routes/leads.js";
import captureRouter from "./routes/capture.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/capture", captureRouter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

// TODO(Phase 8): remove before submission. Satisfies Phase 1 DoD.
app.get("/api/_debug/models", async (req, res) => {
  try {
    const user = await User.findOne({ email: "admin@crm.local" });
    const lead = await Lead.findOne({ name: "Thandi Mokoena" });
    res.json({ user, lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(errorHandler);

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun && process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => console.log(`API listening on ${PORT}`));

  if (process.env.MONGO_URI) {
    mongoose
      .connect(process.env.MONGO_URI)
      .then(() => console.log("Mongo connected"))
      .catch((err) => console.error("Mongo error:", err.message));
  }
}

export default app;
