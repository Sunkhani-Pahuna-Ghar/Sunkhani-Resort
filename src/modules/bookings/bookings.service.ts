import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { MailService } from "../mail/mail.service";
import {
  Booking,
  BookingDocument,
  BookingStatus,
  RoomType,
} from "./entity/booking.entity";
import { RoomNight, RoomNightDocument } from "./entity/room-night.entity";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { listNights, todayInNepal, validateStay } from "./utils/stay.util";

/** Which status changes are allowed. Anything else is refused. */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED],
  [BookingStatus.DECLINED]: [],
  [BookingStatus.CANCELLED]: [],
};

const ROOM_LABELS: Record<RoomType, string> = {
  [RoomType.FARM_RETREAT]: "Farm Retreat",
  [RoomType.MAIN_HOUSE]: "Main House",
};

function datesUnavailable() {
  return new ConflictException({
    statusCode: 409,
    error: "DATES_UNAVAILABLE",
    message: "Those dates are not available for this room type",
  });
}

function isDuplicateKeyError(err: any): boolean {
  return (
    err?.code === 11000 ||
    (Array.isArray(err?.writeErrors) &&
      err.writeErrors.some((e: any) => e?.code === 11000 || e?.err?.code === 11000))
  );
}

/** Only the fields a person should ever see. */
export function toBookingView(b: any) {
  return {
    id: String(b._id),
    roomTypeId: b.roomTypeId,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    guests: b.guests,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestPhone: b.guestPhone ?? null,
    notes: b.notes ?? null,
    status: b.status,
    language: b.language,
    createdAt: b.createdAt,
  };
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(RoomNight.name)
    private readonly nightModel: Model<RoomNightDocument>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Public: only date ranges of confirmed stays. No guest details. */
  async getAvailability(roomTypeId: RoomType) {
    const rows = await this.bookingModel
      .find({
        roomTypeId,
        status: BookingStatus.CONFIRMED,
        checkOut: { $gt: todayInNepal() },
      })
      .select("checkIn checkOut")
      .sort({ checkIn: 1 })
      .lean();
    return rows.map((r) => ({ checkIn: r.checkIn, checkOut: r.checkOut }));
  }

  /** A request is always created as "pending" no matter what the client sends. */
  async create(dto: CreateBookingDto, userId: string | null) {
    const problem = validateStay(dto.checkIn, dto.checkOut, todayInNepal());
    if (problem) throw new BadRequestException(problem);

    const clash = await this.bookingModel.exists({
      roomTypeId: dto.roomTypeId,
      status: BookingStatus.CONFIRMED,
      checkIn: { $lt: dto.checkOut },
      checkOut: { $gt: dto.checkIn },
    });
    if (clash) throw datesUnavailable();

    const booking = await this.bookingModel.create({
      roomTypeId: dto.roomTypeId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guests: dto.guests,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      guestPhone: dto.guestPhone || null,
      notes: dto.notes || null,
      language: dto.language === "ne" ? "ne" : "en",
      status: BookingStatus.PENDING,
      userId: userId ? new Types.ObjectId(userId) : null,
    });

    void this.notifyOwnerOfRequest(booking);

    return {
      id: String(booking._id),
      status: booking.status,
      roomTypeId: booking.roomTypeId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
    };
  }

  async findMine(userId: string) {
    const rows = await this.bookingModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return rows.map(toBookingView);
  }

  async findAll(status?: BookingStatus) {
    const rows = await this.bookingModel
      .find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return rows.map(toBookingView);
  }

  async updateStatus(id: string, newStatus: BookingStatus) {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException("Booking not found");

    const from = booking.status;
    if (!ALLOWED_TRANSITIONS[from]?.includes(newStatus)) {
      throw new BadRequestException(
        `A ${from} booking cannot be changed to ${newStatus}`,
      );
    }

    if (newStatus === BookingStatus.CONFIRMED) {
      await this.reserveNights(booking);
    }

    // Only change it if nobody else changed it in the meantime.
    const updated = await this.bookingModel.findOneAndUpdate(
      { _id: booking._id, status: from },
      { status: newStatus },
      { new: true },
    );

    if (!updated) {
      if (newStatus === BookingStatus.CONFIRMED) await this.releaseNights(booking._id);
      throw new ConflictException(
        "This booking was just changed by someone else. Refresh and try again.",
      );
    }

    // Free the nights only after the status is saved. If this step failed, the dates
    // would stay blocked (the safe direction) instead of becoming double-bookable.
    if (from === BookingStatus.CONFIRMED && newStatus === BookingStatus.CANCELLED) {
      await this.releaseNights(booking._id);
    }

    void this.notifyGuestOfDecision(updated);
    return toBookingView(updated);
  }

  /**
   * Claim every night of the stay. The unique index (roomTypeId, date) makes the database
   * itself refuse a second claim on the same night, even from two servers at once.
   * Nights that end exactly where another stay starts do not clash (check-out day is free).
   */
  private async reserveNights(booking: BookingDocument) {
    const nights = listNights(booking.checkIn, booking.checkOut).map((date) => ({
      roomTypeId: booking.roomTypeId,
      date,
      bookingId: booking._id,
    }));

    try {
      await this.nightModel.insertMany(nights, { ordered: true });
    } catch (err) {
      await this.releaseNights(booking._id); // undo the nights this attempt did claim
      if (isDuplicateKeyError(err)) throw datesUnavailable();
      throw err;
    }
  }

  private async releaseNights(bookingId: unknown) {
    await this.nightModel.deleteMany({ bookingId });
  }

  private async notifyOwnerOfRequest(b: BookingDocument) {
    const owner = this.config.get<string>("OWNER_EMAIL");
    if (!owner) {
      this.logger.warn("OWNER_EMAIL is not set: no email sent for new booking");
      return;
    }
    try {
      await this.mail.send(
        owner,
        `New booking request: ${b.guestName} (${b.checkIn} to ${b.checkOut})`,
        [
          "A new booking request is waiting for you.",
          "",
          `Rooms:  ${ROOM_LABELS[b.roomTypeId] ?? b.roomTypeId}`,
          `Dates:  ${b.checkIn} to ${b.checkOut}`,
          `Guests: ${b.guests}`,
          `Name:   ${b.guestName}`,
          `Email:  ${b.guestEmail}`,
          `Phone:  ${b.guestPhone ?? "-"}`,
          `Notes:  ${b.notes ?? "-"}`,
          "",
          "Open the admin page to confirm or decline it.",
        ].join("\n"),
      );
    } catch (err) {
      this.logger.error(`Owner email failed: ${String(err)}`);
    }
  }

  private async notifyGuestOfDecision(b: BookingDocument) {
    const room = ROOM_LABELS[b.roomTypeId] ?? b.roomTypeId;
    const stay = `${room}, ${b.checkIn} to ${b.checkOut}`;
    const messages: Partial<Record<BookingStatus, [string, string]>> = {
      [BookingStatus.CONFIRMED]: [
        "Your stay at Sunkhani Pahuna Ghar is confirmed",
        `Namaste ${b.guestName},\n\nYour stay is confirmed: ${stay}.\nWe look forward to welcoming you.`,
      ],
      [BookingStatus.DECLINED]: [
        "About your Sunkhani Pahuna Ghar request",
        `Namaste ${b.guestName},\n\nSorry, we cannot host you for ${stay}. Please contact us to find other dates.`,
      ],
      [BookingStatus.CANCELLED]: [
        "Your Sunkhani Pahuna Ghar booking was cancelled",
        `Namaste ${b.guestName},\n\nYour booking for ${stay} has been cancelled. Please contact us if this is a surprise.`,
      ],
    };
    const msg = messages[b.status];
    if (!msg) return;
    try {
      await this.mail.send(b.guestEmail, msg[0], msg[1]);
    } catch (err) {
      this.logger.error(`Guest email failed: ${String(err)}`);
    }
  }
}
