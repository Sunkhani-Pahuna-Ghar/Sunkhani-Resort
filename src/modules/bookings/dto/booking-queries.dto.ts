import { IsIn, IsOptional } from "class-validator";
import { BookingStatus, RoomType } from "../entity/booking.entity";

export class AvailabilityQueryDto {
  @IsIn(Object.values(RoomType))
  roomTypeId!: RoomType;
}

export class AdminBookingsQueryDto {
  @IsOptional()
  @IsIn(Object.values(BookingStatus))
  status?: BookingStatus;
}

export class UpdateBookingStatusDto {
  @IsIn([
    BookingStatus.CONFIRMED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ])
  status!: BookingStatus;
}
