import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { BookingsService } from "../bookings.service";
import { CreateBookingDto } from "../dto/create-booking.dto";
import { AvailabilityQueryDto } from "../dto/booking-queries.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { UserPayload } from "../../../shared/types/user-payload.type";

/** GET /api/availability?roomTypeId=farm-retreat  (public) */
@Controller("availability")
export class AvailabilityController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  get(@Query() query: AvailabilityQueryDto) {
    return this.bookings.getAvailability(query.roomTypeId);
  }
}

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Anyone can request a stay. If they are logged in, it is linked to their account. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: UserPayload | null,
  ) {
    return this.bookings.create(dto, user?.userId ?? null);
  }

  /** A logged-in guest sees only their own bookings. */
  @UseGuards(JwtAuthGuard)
  @Get("mine")
  mine(@CurrentUser() user: UserPayload) {
    return this.bookings.findMine(user.userId);
  }
}
