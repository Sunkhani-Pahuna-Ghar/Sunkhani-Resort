import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Status } from "../enum/user.enum";
import { Role } from "../enum/role.enum";

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

  // Only ever set by the server (make-admin script). Never read from a request body.
  @Prop({ type: String, enum: Role, default: Role.GUEST })
  role!: Role;

  // SHA-256 of the emailed reset token. The token itself is never stored.
  @Prop({ type: String, default: null })
  passwordResetTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
