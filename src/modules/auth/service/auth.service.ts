import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User, UserDocument } from "../entity/user.entity";
import { CreateUserDto } from "../dto/create-user.dto";
import { LoginDto } from "../dto/login.dto";
import { Status } from "../enum/user.enum";
import { Role } from "../enum/role.enum";
import { ForgotPasswordDto } from "../dto/forgot-password.dto";
import { ResetPasswordDto } from "../dto/reset-password.dto";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { MailService } from "../../mail/mail.service";

// Compared against when the email is unknown, so "no such user" and
// "wrong password" take about the same time to answer.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private issueToken(user: UserDocument) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(createUserDto: CreateUserDto) {
    const email = this.normalizeEmail(createUserDto.email);

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    const user = new this.userModel({
      email,
      password: await bcrypt.hash(createUserDto.password, 10),
      firstName: createUserDto.firstName?.trim() || null,
      lastName: createUserDto.lastName?.trim() || null,
      phoneNumber: createUserDto.phoneNumber?.trim() || null,
      status: Status.ACTIVE,
      role: Role.GUEST, // always a guest; admins are made with the make-admin script
    });

    try {
      await user.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException("Email already registered");
      }
      throw err;
    }

    return this.issueToken(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel.findOne({
      email: this.normalizeEmail(loginDto.email),
      status: Status.ACTIVE,
    });

    const passwordOk = await bcrypt.compare(
      loginDto.password,
      user ? user.password : DUMMY_HASH,
    );

    if (!user || !passwordOk) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueToken(user);
  }

  /**
   * Always answers the same way whether or not the email has an account, and never
   * changes the password. The password only changes when the emailed link is used.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = {
      message: "If that email has an account, a reset link has been sent.",
    };

    const user = await this.userModel.findOne({
      email: this.normalizeEmail(dto.email),
      status: Status.ACTIVE,
    });
    if (!user) return generic;

    const token = crypto.randomBytes(32).toString("hex"); // 64 hex chars
    user.passwordResetTokenHash = sha256(token);
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const baseUrl = (
      this.config.get<string>("FRONTEND_URL") || "http://localhost:5173"
    ).replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
      // Do not reveal mail problems to the caller.
      this.logger.error(`Could not send reset email: ${String(err)}`);
    }

    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({
      passwordResetTokenHash: sha256(dto.token),
      passwordResetExpiresAt: { $gt: new Date() },
      status: Status.ACTIVE,
    });

    if (!user) {
      throw new BadRequestException("This reset link is invalid or has expired");
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return { message: "Password changed. You can now log in." };
  }

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select("-password -passwordResetTokenHash -passwordResetExpiresAt")
      .exec();

    if (!user) throw new UnauthorizedException("User not found");
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;

    await user.save();
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid)
      throw new BadRequestException("Current password is incorrect");

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        "New password must differ from current password",
      );
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: "Password changed successfully" };
  }

  async validateUser(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }
}
