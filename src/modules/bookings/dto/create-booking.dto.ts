import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { cleanEmail, cleanLine, cleanMultiline } from "../../../common/utils/text.util";
import { RoomType } from "../entity/booking.entity";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateBookingDto {
  @IsIn(Object.values(RoomType))
  roomTypeId!: RoomType;

  @Matches(DATE_RE, { message: "checkIn must be YYYY-MM-DD" })
  checkIn!: string;

  @Matches(DATE_RE, { message: "checkOut must be YYYY-MM-DD" })
  checkOut!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  guests!: number;

  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  guestName!: string;

  @Transform(({ value }) => cleanEmail(value))
  @IsEmail()
  @MaxLength(254)
  guestEmail!: string;

  @IsOptional()
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MaxLength(30)
  guestPhone?: string;

  @IsOptional()
  @Transform(({ value }) => cleanMultiline(value))
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(["en", "ne"])
  language?: string;
}
