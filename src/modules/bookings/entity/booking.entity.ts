import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum RoomType {
  FARM_RETREAT = "farm-retreat",
  MAIN_HOUSE = "main-house",
}

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: String, enum: RoomType, required: true })
  roomTypeId!: RoomType;

  @Prop({ type: String, required: true })
  checkIn!: string; // YYYY-MM-DD

  @Prop({ type: String, required: true })
  checkOut!: string; // YYYY-MM-DD

  @Prop({ type: Number, required: true })
  guests!: number;

  @Prop({ type: String, required: true })
  guestName!: string;

  @Prop({ type: String, required: true })
  guestEmail!: string;

  @Prop({ type: String, default: null })
  guestPhone!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Prop({ type: String, enum: ["en", "ne"], default: "en" })
  language!: string;

  // Set from the logged-in user's token by the server, never from the request body.
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  userId!: Types.ObjectId | null;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ roomTypeId: 1, status: 1, checkOut: 1 });
BookingSchema.index({ userId: 1, createdAt: -1 });
