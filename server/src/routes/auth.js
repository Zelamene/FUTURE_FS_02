import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { secret, cookieOptions, SESSION_DURATION } from "../config/auth.js";
import { asyncHandler, validate, invalidCredentials } from "../utils/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      await bcrypt.compare(password, "$2b$12$invalidhashtopreventtimingattack");
      throw invalidCredentials();
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw invalidCredentials();
    }

    const token = jwt.sign({ sub: user.id }, secret, {
      expiresIn: SESSION_DURATION,
    });

    res.cookie("auth", token, cookieOptions);
    res.json(user);
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie("auth", {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
    });
    res.status(204).end();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

export default router;
