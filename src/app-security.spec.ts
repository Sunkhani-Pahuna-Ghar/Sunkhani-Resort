process.env.JWT_SECRET = "test-secret-for-jest";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { getModelToken } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { TransformInterceptor } from "./common/interceptors/transform-response.interceptor";
import { AuthController } from "./modules/auth/controllers/auth.controller";
import { JwtStrategy } from "./modules/auth/guards/jwt-strategy.guard";
import { User } from "./modules/auth/entity/user.entity";
import { AuthService } from "./modules/auth/service/auth.service";
import { BookingsService } from "./modules/bookings/bookings.service";
import {
  AvailabilityController,
  BookingsController,
} from "./modules/bookings/controllers/bookings.controller";
import { AdminBookingsController } from "./modules/bookings/controllers/admin-bookings.controller";
import {
  AdminInquiriesController,
  InquiriesController,
} from "./modules/inquiries/controllers/inquiries.controller";
import { InquiriesService } from "./modules/inquiries/inquiries.service";

const users: any[] = [];
const fakeUserModel = {
  findOne: async (q: any) =>
    users.find((u) => u.id === q._id && u.status === q.status) ?? null,
};
const bookingsMock = {
  getAvailability: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: "b1", status: "pending" }),
  findMine: jest.fn().mockResolvedValue([]),
  findAll: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn().mockResolvedValue({ id: "b1", status: "confirmed" }),
};
const inquiriesMock = {
  create: jest.fn().mockResolvedValue({ id: "i1" }),
  findAll: jest.fn().mockResolvedValue([]),
};
const authMock = {
  register: jest.fn().mockResolvedValue({ accessToken: "x" }),
  login: jest.fn(),
  forgotPassword: jest.fn().mockResolvedValue({ message: "ok" }),
  resetPassword: jest.fn().mockResolvedValue({ message: "ok" }),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
};

let app: INestApplication;
let jwt: JwtService;
const tokenFor = (id: string) => jwt.sign({ sub: id, email: `${id}@example.com` });

const validBooking = {
  roomTypeId: "farm-retreat",
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  guests: 2,
  guestName: "Sita Devi",
  guestEmail: "sita@example.com",
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: "1h" } }),
    ],
    controllers: [
      AvailabilityController,
      BookingsController,
      AdminBookingsController,
      InquiriesController,
      AdminInquiriesController,
      AuthController,
    ],
    providers: [
      JwtStrategy,
      { provide: getModelToken(User.name), useValue: fakeUserModel },
      { provide: BookingsService, useValue: bookingsMock },
      { provide: InquiriesService, useValue: inquiriesMock },
      { provide: AuthService, useValue: authMock },
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  jwt = moduleRef.get(JwtService);
});

afterAll(async () => app.close());

beforeEach(() => {
  jest.clearAllMocks();
  users.length = 0;
  users.push(
    { id: "guest1", email: "guest1@example.com", role: "GUEST", status: "ACTIVE" },
    { id: "admin1", email: "admin1@example.com", role: "ADMIN", status: "ACTIVE" },
    { id: "gone1", email: "gone1@example.com", role: "ADMIN", status: "INACTIVE" },
  );
});

describe("availability", () => {
  it("needs a valid room type", async () => {
    await request(app.getHttpServer()).get("/api/availability").expect(400);
    await request(app.getHttpServer()).get("/api/availability?roomTypeId=penthouse").expect(400);
    await request(app.getHttpServer()).get("/api/availability?roomTypeId=farm-retreat").expect(200);
    expect(bookingsMock.getAvailability).toHaveBeenCalledWith("farm-retreat");
  });
});

describe("POST /api/bookings", () => {
  const post = (body: any, token?: string) => {
    const r = request(app.getHttpServer()).post("/api/bookings");
    if (token) r.set("Authorization", `Bearer ${token}`);
    return r.send(body);
  };

  it("works anonymously and records no user", async () => {
    await post(validBooking).expect(201);
    expect(bookingsMock.create.mock.calls[0][1]).toBeNull();
  });

  it("links the booking to the logged-in user (taken from the token)", async () => {
    await post(validBooking, tokenFor("guest1")).expect(201);
    expect(bookingsMock.create.mock.calls[0][1]).toBe("guest1");
  });

  it("treats a bad token as anonymous instead of failing", async () => {
    await post(validBooking, "garbage.token.here").expect(201);
    expect(bookingsMock.create.mock.calls[0][1]).toBeNull();
  });

  it("strips fields a client must not control (status, userId, role)", async () => {
    await post({ ...validBooking, status: "confirmed", userId: "someone", role: "ADMIN" }).expect(201);
    const dto = bookingsMock.create.mock.calls[0][0];
    expect(dto).not.toHaveProperty("status");
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("role");
  });

  it("cleans names and emails", async () => {
    await post({ ...validBooking, guestName: "  Sita\r\nBcc: x@evil.com ", guestEmail: "  SITA@Example.com " }).expect(201);
    const dto = bookingsMock.create.mock.calls[0][0];
    expect(dto.guestName).toBe("Sita Bcc: x@evil.com");
    expect(dto.guestEmail).toBe("sita@example.com");
  });

  it.each([
    ["unknown room type", { roomTypeId: "penthouse" }],
    ["room type as an object", { roomTypeId: { $ne: "x" } }],
    ["bad date format", { checkIn: "10/01/2030" }],
    ["guests as text", { guests: "2" }],
    ["zero guests", { guests: 0 }],
    ["21 guests", { guests: 21 }],
    ["fractional guests", { guests: 1.5 }],
    ["name as an object", { guestName: { $gt: "" } }],
    ["empty name", { guestName: "   " }],
    ["name over 100 chars", { guestName: "a".repeat(101) }],
    ["bad email", { guestEmail: "not-an-email" }],
    ["email over 254 chars", { guestEmail: `${"a".repeat(250)}@x.com` }],
    ["phone over 30 chars", { guestPhone: "1".repeat(31) }],
    ["notes over 1000 chars", { notes: "n".repeat(1001) }],
    ["unknown language", { language: "fr" }],
  ])("rejects %s", async (_label, patch) => {
    await post({ ...validBooking, ...patch }).expect(400);
    expect(bookingsMock.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/bookings/mine", () => {
  it("needs login and uses the id from the token", async () => {
    await request(app.getHttpServer()).get("/api/bookings/mine").expect(401);
    await request(app.getHttpServer())
      .get("/api/bookings/mine")
      .set("Authorization", `Bearer ${tokenFor("guest1")}`)
      .expect(200);
    expect(bookingsMock.findMine).toHaveBeenCalledWith("guest1");
  });
});

describe("admin routes", () => {
  const adminRoutes = [
    () => request(app.getHttpServer()).get("/api/admin/bookings"),
    () => request(app.getHttpServer()).patch("/api/admin/bookings/64b64b64b64b64b64b64b64b").send({ status: "confirmed" }),
    () => request(app.getHttpServer()).get("/api/admin/inquiries"),
  ];

  it("401 without a token", async () => {
    for (const r of adminRoutes) await r().expect(401);
  });

  it("403 for a normal guest", async () => {
    for (const r of adminRoutes) await r().set("Authorization", `Bearer ${tokenFor("guest1")}`).expect(403);
    expect(bookingsMock.findAll).not.toHaveBeenCalled();
    expect(bookingsMock.updateStatus).not.toHaveBeenCalled();
    expect(inquiriesMock.findAll).not.toHaveBeenCalled();
  });

  it("200 for an admin", async () => {
    for (const r of adminRoutes) await r().set("Authorization", `Bearer ${tokenFor("admin1")}`).expect(200);
  });

  it("401 for a deactivated admin", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/bookings")
      .set("Authorization", `Bearer ${tokenFor("gone1")}`)
      .expect(401);
  });

  it("reads the role from the database, not the token", async () => {
    const token = tokenFor("guest1");
    const call = () => request(app.getHttpServer()).get("/api/admin/bookings").set("Authorization", `Bearer ${token}`);
    await call().expect(403);
    users.find((u) => u.id === "guest1").role = "ADMIN"; // promoted
    await call().expect(200);
    users.find((u) => u.id === "guest1").role = "GUEST"; // demoted: same old token stops working
    await call().expect(403);
  });

  it("a token cannot claim its own role", async () => {
    const forged = jwt.sign({ sub: "guest1", email: "guest1@example.com", role: "ADMIN" });
    await request(app.getHttpServer()).get("/api/admin/bookings").set("Authorization", `Bearer ${forged}`).expect(403);
  });

  it("validates the booking id and status", async () => {
    const auth = { Authorization: `Bearer ${tokenFor("admin1")}` };
    await request(app.getHttpServer()).patch("/api/admin/bookings/not-an-id").set(auth).send({ status: "confirmed" }).expect(400);
    await request(app.getHttpServer()).patch("/api/admin/bookings/64b64b64b64b64b64b64b64b").set(auth).send({ status: "pending" }).expect(400);
    await request(app.getHttpServer()).patch("/api/admin/bookings/64b64b64b64b64b64b64b64b").set(auth).send({ status: "hacked" }).expect(400);
    await request(app.getHttpServer()).get("/api/admin/bookings?status=hacked").set(auth).expect(400);
    expect(bookingsMock.updateStatus).not.toHaveBeenCalled();
  });
});

describe("auth endpoints", () => {
  it("never passes a role from sign-up to the service", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email: "a@example.com", password: "longenough1", role: "ADMIN" })
      .expect(201);
    expect(authMock.register.mock.calls[0][0]).not.toHaveProperty("role");
  });

  it("enforces password length (8 to 72)", async () => {
    const post = (password: string) =>
      request(app.getHttpServer()).post("/api/auth/register").send({ email: "a@example.com", password });
    await post("short").expect(400);
    await post("x".repeat(73)).expect(400);
    await post("x".repeat(72)).expect(201);
  });

  it("reset-password needs a 64-character token", async () => {
    await request(app.getHttpServer()).post("/api/auth/reset-password").send({ token: "abc", newPassword: "longenough1" }).expect(400);
    await request(app.getHttpServer()).post("/api/auth/reset-password").send({ token: "a".repeat(64), newPassword: "longenough1" }).expect(201);
  });

  it("the old temp-password routes are gone", async () => {
    await request(app.getHttpServer()).post("/api/auth/verify-temp-password").send({}).expect(404);
  });
});

describe("inquiries", () => {
  it("accepts a valid message and rejects bad ones", async () => {
    const post = (b: any) => request(app.getHttpServer()).post("/api/inquiries").send(b);
    await post({ name: "Ram", email: "ram@example.com", message: "Hello" }).expect(201);
    await post({ name: "Ram", email: "bad", message: "Hello" }).expect(400);
    await post({ name: "Ram", email: "ram@example.com", message: "" }).expect(400);
    await post({ name: "Ram", email: "ram@example.com", message: "m".repeat(2001) }).expect(400);
  });
});
