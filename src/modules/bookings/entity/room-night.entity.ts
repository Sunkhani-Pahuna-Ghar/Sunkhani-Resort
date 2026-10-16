import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RoomNightDocument = RoomNight & Document;

/**
 * One document per occupied night of a CONFIRMED booking.
 * The unique index on (roomTypeId, date) is what makes double-booking impossible:
 * if two confirmations race for the same night, the database rejects the second one.
 */
@Schema()
export class RoomNight {
  @Prop({ type: String, required: true })
  roomTypeId!: string;

  @Prop({ type: String, required: true })
  date!: string; // YYYY-MM-DD

  @Prop({ type: Types.ObjectId, ref: "Booking", required: true })
  bookingId!: Types.ObjectId;
}

export const RoomNightSchema = SchemaFactory.createForClass(RoomNight);
RoomNightSchema.index({ roomTypeId: 1, date: 1 }, { unique: true });
RoomNightSchema.index({ bookingId: 1 });
