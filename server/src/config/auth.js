export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_DURATION = "7d";

const isProd = process.env.NODE_ENV === "production";

const JWT_SECRET = process.env.JWT_SECRET;
if (isProd && !JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

export const secret = JWT_SECRET || "dev-jwt-secret-do-not-use-in-production";

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: SESSION_DURATION_MS,
};
