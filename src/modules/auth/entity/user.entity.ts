import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Status } from "../enum/user.enum";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ type: String, default: null })
  firstName!: string | null;

  @Prop({ type: String, default: null })
  lastName!: string | null;

  @Prop({ type: String, default: null })
  phoneNumber!: string | null;

  @Prop({ type: String, enum: Status, default: Status.ACTIVE })
  status!: Status;

  @Prop({ type: String, default: null })
  tempPassword!: string | null;

  @Prop({ type: Boolean, default: false })
  isTempPassword!: boolean;

  @Prop({ type: Date, default: null })
  tempPasswordExpiresAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
