import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { secret } from "../config/auth.js";
import { unauthorized } from "../utils/errors.js";

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.auth;
    if (!token) {
      return next(unauthorized());
    }

    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      return next(unauthorized());
    }

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      return next(unauthorized());
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
