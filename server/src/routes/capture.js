import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Lead, Note } from "../models/index.js";
import { asyncHandler, validate } from "../utils/errors.js";
import { recordActivity } from "../services/activity.js";
import { emit } from "../realtime/broadcaster.js";

const router = Router();

const captureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () =>
    (process.env.NODE_ENV === "test" ||
      process.execArgv.some((a) => a.includes("test")) ||
      process.argv.some((a) => a.includes("test"))) &&
    process.env.TEST_RATE_LIMIT !== "true",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, please try again later",
      },
    }),
});

const captureSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(1, "Name is required").max(120, "Name cannot exceed 120 characters"),
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Invalid email address"),
  phone: z.string().trim().max(30, "Phone cannot exceed 30 characters").nullable().optional(),
  company: z.string().trim().max(120, "Company cannot exceed 120 characters").nullable().optional(),
  source: z.enum(["contact-form", "referral", "whatsapp", "other"], { required_error: "Source is required" }),
  message: z.string({ required_error: "Message is required" }).trim().min(1, "Message is required").max(2000, "Message cannot exceed 2000 characters"),
  botField: z.string().nullable().optional(),
});

router.post(
  "/",
  captureLimiter,
  validate(captureSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, company, source, message, botField } = req.body;

    const isBot = typeof botField === "string" && botField.trim().length > 0;
    if (isBot) {
      return res.json({
        ok: true,
        message: "Thanks — we'll be in touch.",
      });
    }

    const lead = await Lead.create({
      name,
      email,
      phone: phone || null,
      company: company || null,
      source,
      status: "new",
    });

    let note = null;
    try {
      note = await Note.create({
        leadId: lead._id,
        authorId: null,
        source: "capture",
        body: message,
      });
    } catch (err) {
      console.error("Note creation failed on capture:", err.message);
    }

    emit("lead.created", { lead: lead.toJSON() });

    await recordActivity({
      leadId: lead._id,
      actorId: null,
      type: "lead_created",
      meta: { source: lead.source },
    });

    if (note) {
      await recordActivity({
        leadId: lead._id,
        actorId: null,
        type: "note_added",
        meta: { noteId: note._id },
      });
    }

    res.json({
      ok: true,
      message: "Thanks — we'll be in touch.",
    });
  })
);

export default router;
