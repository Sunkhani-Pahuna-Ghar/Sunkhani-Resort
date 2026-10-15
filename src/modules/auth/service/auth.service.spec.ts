process.env.JWT_SECRET = "test-secret-for-jest";

import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { AuthService } from "./auth.service";

function matches(u: any, q: any): boolean {
  return Object.entries(q).every(([k, v]: [string, any]) =>
    v && typeof v === "object" && "$gt" in v ? u[k] != null && u[k] > v.$gt : u[k] === v,
  );
}

class FakeUserModel {
  static users: any[] = [];
  static seq = 0;
  [k: string]: any;
  constructor(doc: any) {
    Object.assign(this, {
      id: `u${++FakeUserModel.seq}`,
      status: "ACTIVE",
      role: "GUEST",
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      ...doc,
    });
  }
  async save() {
    if (!FakeUserModel.users.includes(this)) {
      if (FakeUserModel.users.some((u) => u.email === this.email)) {
        throw Object.assign(new Error("dup"), { code: 11000 });
      }
      FakeUserModel.users.push(this);
    }
    return this;
  }
  static async findOne(q: any) {
    return FakeUserModel.users.find((u) => matches(u, q)) ?? null;
  }
}

function setup() {
  FakeUserModel.users = [];
  const mail = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (k: string) => (k === "FRONTEND_URL" ? "https://staysunkhani.com/" : undefined) };
  const jwt = new JwtService({ secret: "x" });
  const service = new AuthService(FakeUserModel as any, jwt, mail as any, config as any);
  return { service, mail };
}

const signup = { email: "  Iraj@Example.COM ", password: "correct-horse-1", firstName: "Iraj" } as any;

describe("register", () => {
  it("normalises the email, hashes the password and makes a guest", async () => {
    const { service } = setup();
    const res = await service.register({ ...signup, role: "ADMIN" });
    const stored = FakeUserModel.users[0];
    expect(stored.email).toBe("iraj@example.com");
    expect(stored.password).not.toBe(signup.password);
    expect(await bcrypt.compare(signup.password, stored.password)).toBe(true);
    expect(stored.role).toBe("GUEST"); // even if a role sneaks in, it is ignored
    expect(res.user.role).toBe("GUEST");
    expect(res.accessToken).toBeTruthy();
  });

  it("refuses a duplicate email, whatever the capitalisation", async () => {
    const { service } = setup();
    await service.register(signup);
    await expect(service.register({ ...signup, email: "IRAJ@example.com" })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("login", () => {
  it("logs in with the right password", async () => {
    const { service } = setup();
    await service.register(signup);
    const res = await service.login({ email: "IRAJ@example.com", password: signup.password });
    expect(res.accessToken).toBeTruthy();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const { service } = setup();
    await service.register(signup);
    const wrongPw = await service.login({ email: "iraj@example.com", password: "nope-nope-1" }).catch((e) => e);
    const noUser = await service.login({ email: "nobody@example.com", password: "nope-nope-1" }).catch((e) => e);
    expect(wrongPw).toBeInstanceOf(UnauthorizedException);
    expect(noUser).toBeInstanceOf(UnauthorizedException);
    expect(wrongPw.message).toBe(noUser.message);
  });

  it("blocks inactive accounts", async () => {
    const { service } = setup();
    await service.register(signup);
    FakeUserModel.users[0].status = "INACTIVE";
    await expect(service.login({ email: "iraj@example.com", password: signup.password })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("password reset", () => {
  async function requestToken(service: AuthService, mail: any) {
    await service.forgotPassword({ email: "iraj@example.com" });
    const url: string = mail.sendPasswordResetEmail.mock.calls[0][1];
    return url.split("token=")[1];
  }

  it("answers identically for known and unknown emails, and only emails real accounts", async () => {
    const { service, mail } = setup();
    await service.register(signup);
    const known = await service.forgotPassword({ email: "iraj@example.com" });
    const unknown = await service.forgotPassword({ email: "nobody@example.com" });
    expect(known).toEqual(unknown);
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("does NOT change the password when a reset is requested (no lock-out by strangers)", async () => {
    const { service } = setup();
    await service.register(signup);
    const before = FakeUserModel.users[0].password;
    await service.forgotPassword({ email: "iraj@example.com" });
    expect(FakeUserModel.users[0].password).toBe(before);
    await expect(service.login({ email: "iraj@example.com", password: signup.password })).resolves.toBeDefined();
  });

  it("emails a link on the site with a 64-character token, and stores only its hash", async () => {
    const { service, mail } = setup();
    await service.register(signup);
    const token = await requestToken(service, mail);
    const url: string = mail.sendPasswordResetEmail.mock.calls[0][1];
    expect(url.startsWith("https://staysunkhani.com/reset-password?token=")).toBe(true);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = FakeUserModel.users[0];
    expect(stored.passwordResetTokenHash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("resets the password with the token, once only", async () => {
    const { service, mail } = setup();
    await service.register(signup);
    const token = await requestToken(service, mail);
    await service.resetPassword({ token, newPassword: "brand-new-pass-2" });
    await expect(service.login({ email: "iraj@example.com", password: "brand-new-pass-2" })).resolves.toBeDefined();
    await expect(service.login({ email: "iraj@example.com", password: signup.password })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.resetPassword({ token, newPassword: "another-pass-3" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses wrong or expired tokens", async () => {
    const { service, mail } = setup();
    await service.register(signup);
    const token = await requestToken(service, mail);
    await expect(service.resetPassword({ token: "0".repeat(64), newPassword: "brand-new-pass-2" })).rejects.toBeInstanceOf(BadRequestException);
    FakeUserModel.users[0].passwordResetExpiresAt = new Date(Date.now() - 1000);
    await expect(service.resetPassword({ token, newPassword: "brand-new-pass-2" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not reveal mail failures", async () => {
    const { service, mail } = setup();
    await service.register(signup);
    mail.sendPasswordResetEmail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(service.forgotPassword({ email: "iraj@example.com" })).resolves.toHaveProperty("message");
  });
});
