import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type InquiryDocument = Inquiry & Document;

@Schema({ timestamps: true })
export class Inquiry {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: String, enum: ["new", "read"], default: "new" })
  status!: string;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);
InquirySchema.index({ createdAt: -1 });
