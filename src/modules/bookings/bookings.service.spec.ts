import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { BookingStatus, RoomType } from "./entity/booking.entity";
import { formatDateOnly, parseDateOnly, todayInNepal } from "./utils/stay.util";

const DAY = 86400000;
function inDays(n: number): string {
  return formatDateOnly(new Date(parseDateOnly(todayInNepal())!.getTime() + n * DAY));
}

/** Tiny stand-in for the bookings collection. */
class FakeBookingModel {
  rows: any[] = [];
  private seq = 0;

  async create(doc: any) {
    const row = { _id: `b${++this.seq}`, createdAt: new Date(), ...doc };
    this.rows.push(row);
    return { ...row };
  }
  async findById(id: string) {
    const r = this.rows.find((x) => x._id === id);
    return r ? { ...r } : null;
  }
  async findOneAndUpdate(filter: any, update: any) {
    const r = this.rows.find((x) => x._id === filter._id && x.status === filter.status);
    if (!r) return null;
    Object.assign(r, update);
    return { ...r };
  }
  async exists(q: any) {
    const hit = this.rows.find(
      (r) =>
        r.roomTypeId === q.roomTypeId &&
        r.status === q.status &&
        r.checkIn < q.checkIn.$lt &&
        r.checkOut > q.checkOut.$gt,
    );
    return hit ? { _id: hit._id } : null;
  }
  find(q: any) {
    let out = this.rows.filter(
      (r) =>
        (!q.roomTypeId || r.roomTypeId === q.roomTypeId) &&
        (!q.status || r.status === q.status) &&
        (!q.checkOut || r.checkOut > q.checkOut.$gt),
    );
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      limit: () => chain,
      lean: async () => out,
    };
    return chain;
  }
}

/** Stand-in for the room-nights collection, with the same unique (roomTypeId, date) rule. */
class FakeNightModel {
  rows: any[] = [];
  async insertMany(docs: any[]) {
    for (const d of docs) {
      if (this.rows.some((r) => r.roomTypeId === d.roomTypeId && r.date === d.date)) {
        const err: any = new Error("E11000 duplicate key");
        err.code = 11000;
        throw err;
      }
      this.rows.push({ ...d });
    }
  }
  async deleteMany(q: any) {
    this.rows = this.rows.filter((r) => r.bookingId !== q.bookingId);
  }
}

function setup() {
  const bookings = new FakeBookingModel();
  const nights = new FakeNightModel();
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((k: string) => (k === "OWNER_EMAIL" ? "owner@example.com" : undefined)) };
  const service = new BookingsService(bookings as any, nights as any, mail as any, config as any);
  return { service, bookings, nights, mail };
}

const base = {
  roomTypeId: RoomType.FARM_RETREAT,
  guests: 2,
  guestName: "Sita Devi",
  guestEmail: "sita@example.com",
};
function req(checkIn: string, checkOut: string, extra: any = {}) {
  return { ...base, checkIn, checkOut, ...extra } as any;
}

describe("BookingsService.create", () => {
  it("creates a pending request and emails the owner", async () => {
    const { service, bookings, mail } = setup();
    const res = await service.create(req(inDays(10), inDays(13)), null);
    expect(res.status).toBe(BookingStatus.PENDING);
    expect(bookings.rows).toHaveLength(1);
    await new Promise((r) => setImmediate(r));
    expect(mail.send).toHaveBeenCalledWith("owner@example.com", expect.stringContaining("Sita Devi"), expect.any(String));
  });

  it("ignores a status sent by the client", async () => {
    const { service, bookings } = setup();
    await service.create(req(inDays(10), inDays(12), { status: "confirmed" }), null);
    expect(bookings.rows[0].status).toBe(BookingStatus.PENDING);
  });

  it("rejects invalid stays (past, too long, backwards)", async () => {
    const { service } = setup();
    await expect(service.create(req(inDays(-2), inDays(1)), null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(req(inDays(5), inDays(70)), null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(req(inDays(5), inDays(5)), null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses dates that overlap a confirmed stay, but allows back-to-back", async () => {
    const { service } = setup();
    const first = await service.create(req(inDays(10), inDays(14)), null);
    await service.updateStatus(first.id, BookingStatus.CONFIRMED);

    await expect(service.create(req(inDays(12), inDays(16)), null)).rejects.toMatchObject({
      response: { error: "DATES_UNAVAILABLE" },
    });
    await expect(service.create(req(inDays(14), inDays(16)), null)).resolves.toBeDefined(); // arrives the day they leave
    await expect(service.create(req(inDays(8), inDays(10)), null)).resolves.toBeDefined(); // leaves the day they arrive
  });

  it("does not let a pending request block dates", async () => {
    const { service } = setup();
    await service.create(req(inDays(10), inDays(14)), null);
    await expect(service.create(req(inDays(11), inDays(13)), null)).resolves.toBeDefined();
  });

  it("does not clash across room types", async () => {
    const { service } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await expect(
      service.create(req(inDays(10), inDays(14), { roomTypeId: RoomType.MAIN_HOUSE }), null),
    ).resolves.toBeDefined();
  });
});

describe("BookingsService.updateStatus", () => {
  it("cannot confirm two overlapping requests (the second is refused)", async () => {
    const { service, nights } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    const b = await service.create(req(inDays(12), inDays(16)), null); // both pending, so allowed
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await expect(service.updateStatus(b.id, BookingStatus.CONFIRMED)).rejects.toMatchObject({
      response: { error: "DATES_UNAVAILABLE" },
    });
    // b must not leave any half-claimed nights behind
    expect(nights.rows.every((r) => r.bookingId === a.id)).toBe(true);
    expect(nights.rows).toHaveLength(4);
  });

  it("still pending after a refused confirmation", async () => {
    const { service, bookings } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    const b = await service.create(req(inDays(13), inDays(16)), null);
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await expect(service.updateStatus(b.id, BookingStatus.CONFIRMED)).rejects.toBeInstanceOf(ConflictException);
    expect(bookings.rows.find((r) => r._id === b.id).status).toBe(BookingStatus.PENDING);
  });

  it("allows confirming back-to-back stays", async () => {
    const { service } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    const b = await service.create(req(inDays(14), inDays(17)), null);
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await expect(service.updateStatus(b.id, BookingStatus.CONFIRMED)).resolves.toMatchObject({ status: "confirmed" });
  });

  it("frees the nights when a confirmed booking is cancelled", async () => {
    const { service, nights } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    const b = await service.create(req(inDays(11), inDays(13)), null);
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await service.updateStatus(a.id, BookingStatus.CANCELLED);
    expect(nights.rows).toHaveLength(0);
    await expect(service.updateStatus(b.id, BookingStatus.CONFIRMED)).resolves.toBeDefined();
  });

  it("declining claims no nights", async () => {
    const { service, nights } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    await service.updateStatus(a.id, BookingStatus.DECLINED);
    expect(nights.rows).toHaveLength(0);
  });

  it("refuses changes that are not allowed", async () => {
    const { service } = setup();
    const a = await service.create(req(inDays(10), inDays(12)), null);
    await service.updateStatus(a.id, BookingStatus.DECLINED);
    await expect(service.updateStatus(a.id, BookingStatus.CONFIRMED)).rejects.toBeInstanceOf(BadRequestException);

    const b = await service.create(req(inDays(20), inDays(22)), null);
    await service.updateStatus(b.id, BookingStatus.CONFIRMED);
    await expect(service.updateStatus(b.id, BookingStatus.DECLINED)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateStatus(b.id, BookingStatus.CONFIRMED)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s for an unknown booking", async () => {
    const { service } = setup();
    await expect(service.updateStatus("nope", BookingStatus.CONFIRMED)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("emails the guest about the decision", async () => {
    const { service, mail } = setup();
    const a = await service.create(req(inDays(10), inDays(12)), null);
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    await new Promise((r) => setImmediate(r));
    expect(mail.send).toHaveBeenCalledWith("sita@example.com", expect.stringContaining("confirmed"), expect.any(String));
  });
});

describe("BookingsService.getAvailability", () => {
  it("returns only confirmed ranges, with no guest details", async () => {
    const { service } = setup();
    const a = await service.create(req(inDays(10), inDays(14)), null);
    await service.create(req(inDays(20), inDays(22)), null); // pending: must not show
    await service.updateStatus(a.id, BookingStatus.CONFIRMED);
    const res: any[] = await service.getAvailability(RoomType.FARM_RETREAT);
    expect(res).toHaveLength(1);
    expect(Object.keys(res[0]).sort()).toEqual(["checkIn", "checkOut"]);
  });
});
