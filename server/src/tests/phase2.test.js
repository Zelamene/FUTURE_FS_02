import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../index.js";
import { seedDatabase } from "../scripts/seed.js";
import { User } from "../models/index.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedDatabase();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function extractAuthCookie(res) {
  const header = res.headers["set-cookie"];
  if (!header) return null;
  const cookies = Array.isArray(header) ? header : [header];
  const authCookie = cookies.find((c) => c.startsWith("auth="));
  return authCookie ?? null;
}

describe("POST /api/auth/login", () => {
  it("returns 200 and sets auth cookie with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local", password: "admin1234" });

    assert.equal(res.status, 200, "status should be 200");
    assert.equal(res.body.email, "admin@crm.local");
    assert.ok(res.body.id, "should have id");
    assert.equal(res.body.passwordHash, undefined, "passwordHash must not be exposed");
    assert.equal(res.body.__v, undefined, "__v must not be exposed");
    assert.equal(res.body._id, undefined, "_id must not be exposed");

    const cookie = extractAuthCookie(res);
    assert.ok(cookie, "auth cookie should be set");
    assert.ok(cookie.includes("HttpOnly"), "cookie must be HttpOnly");
    assert.ok(cookie.includes("Path=/"), "cookie must have Path=/");
  });

  it("returns 401 INVALID_CREDENTIALS with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local", password: "wrongpassword" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
    assert.equal(extractAuthCookie(res), null);
  });

  it("returns 401 INVALID_CREDENTIALS with unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@crm.local", password: "whatever" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  it("returns 400 VALIDATION_ERROR when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "admin1234" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields?.email, "should report email field error");
  });

  it("returns 400 VALIDATION_ERROR when email is malformed", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "admin1234" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields?.email);
  });

  it("returns 400 VALIDATION_ERROR when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields?.password);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204 and clears the auth cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local", password: "admin1234" });
    assert.equal(loginRes.status, 200);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", extractAuthCookie(loginRes));

    assert.equal(logoutRes.status, 204);
    assert.equal(logoutRes.text, "");

    const cookie = extractAuthCookie(logoutRes);
    if (cookie) {
      const isCleared =
        cookie.includes("Max-Age=0") ||
        cookie.includes("Expires=Thu, 01 Jan 1970");
      assert.ok(isCleared, "logout should clear the auth cookie");
    }
  });

  it("returns 204 even when called without a cookie (idempotent logout)", async () => {
    const res = await request(app).post("/api/auth/logout");
    assert.equal(res.status, 204);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 UNAUTHORIZED when no cookie is present", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("returns 200 and the user object with a valid cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local", password: "admin1234" });
    assert.equal(loginRes.status, 200);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", extractAuthCookie(loginRes));

    assert.equal(res.status, 200);
    assert.equal(res.body.email, "admin@crm.local");
    assert.equal(res.body.passwordHash, undefined);
    assert.equal(res.body._id, undefined);
  });

  it("returns 401 UNAUTHORIZED with a tampered token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "auth=tampered.jwt.token");

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("returns 401 UNAUTHORIZED with a syntactically valid JWT but wrong secret", async () => {
    const { default: jwt } = await import("jsonwebtoken");
    const fakeToken = jwt.sign({ sub: "000000000000000000000000" }, "wrong-secret", {
      expiresIn: "7d",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `auth=${fakeToken}`);

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("returns 401 UNAUTHORIZED when the token is valid but the user was deleted", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@crm.local", password: "admin1234" });

    const cookie = extractAuthCookie(loginRes);

    await User.deleteMany({});

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");

    await seedDatabase();
  });
});
