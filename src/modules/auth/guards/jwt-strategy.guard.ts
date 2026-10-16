import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectModel } from "@nestjs/mongoose";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Model } from "mongoose";
import { User, UserDocument } from "../entity/user.entity";
import { Status } from "../enum/user.enum";

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to your .env file.");
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(),
    });
  }

  async validate(payload: any) {
    const user = await this.userModel.findOne({
      _id: payload.sub,
      status: Status.ACTIVE,
    });

    if (!user) {
      throw new UnauthorizedException("User not found or inactive");
    }

    // The role is read from the database on every request (never from the token),
    // so removing someone's admin role takes effect immediately.
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
