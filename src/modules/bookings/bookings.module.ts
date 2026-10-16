import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MailModule } from "../mail/mail.module";
import { Booking, BookingSchema } from "./entity/booking.entity";
import { RoomNight, RoomNightSchema } from "./entity/room-night.entity";
import { BookingsService } from "./bookings.service";
import {
  AvailabilityController,
  BookingsController,
} from "./controllers/bookings.controller";
import { AdminBookingsController } from "./controllers/admin-bookings.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: RoomNight.name, schema: RoomNightSchema },
    ]),
    MailModule,
  ],
  controllers: [
    AvailabilityController,
    BookingsController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
