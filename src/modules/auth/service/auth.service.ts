import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User, UserDocument } from "../entity/user.entity";
import { CreateUserDto } from "../dto/create-user.dto";
import { LoginDto } from "../dto/login.dto";
import { Status } from "../enum/user.enum";
import { VerifyTempPasswordDto } from "../dto/verify-temp-pswd.dto";
import { ResetPasswordDto } from "../dto/reset-pswd.dto";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { MailService } from "../../mail/mail.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private generateTempPassword(): string {
    return crypto.randomBytes(4).toString("hex");
  }

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
      isTempPassword: false,
      status: Status.ACTIVE,
    });

    await user.save();

    return this.issueToken(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel.findOne({
      email: this.normalizeEmail(loginDto.email),
      status: Status.ACTIVE,
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.isTempPassword) {
      if (
        user.tempPasswordExpiresAt &&
        new Date() > user.tempPasswordExpiresAt
      ) {
        throw new UnauthorizedException(
          "Temporary password has expired. Please request a new one.",
        );
      }

      return {
        requirePasswordChange: true,
        message: "Please change your temporary password",
        email: user.email,
      };
    }

    return this.issueToken(user);
  }

  async verifyTempPasswordAndSetNew(verifyDto: VerifyTempPasswordDto) {
    const user = await this.userModel.findOne({
      email: verifyDto.email,
      status: Status.ACTIVE,
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isTempPassword) {
      throw new BadRequestException("User does not have a temporary password");
    }

    if (user.tempPasswordExpiresAt && new Date() > user.tempPasswordExpiresAt) {
      throw new UnauthorizedException("Temporary password has expired");
    }

    if (verifyDto.tempPassword !== user.tempPassword) {
      throw new UnauthorizedException("Invalid temporary password");
    }

    const hashedNewPassword = await bcrypt.hash(verifyDto.newPassword, 10);

    user.password = hashedNewPassword;
    user.isTempPassword = false;
    user.tempPassword = null;
    user.tempPasswordExpiresAt = null;

    await user.save();

    const payload = { email: user.email, sub: user.id };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
      },
      message: "Password changed successfully",
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.userModel.findOne({
      email: resetPasswordDto.email,
    });

    if (!user) {
      return {
        message: "If the email exists, a temporary password has been sent",
      };
    }

    const tempPassword = this.generateTempPassword();
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    user.password = hashedTempPassword;
    user.isTempPassword = true;
    user.tempPassword = tempPassword;
    user.tempPasswordExpiresAt = expiresAt;

    await user.save();

    await this.mailService.sendPasswordResetEmail(
      user.email,
      tempPassword,
      expiresAt,
    );

    return {
      message: "Temporary password generated",
      email: user.email,
      expiresAt: expiresAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select("-password -tempPassword -tempPasswordExpiresAt -isTempPassword")
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
    user.isTempPassword = false;
    await user.save();

    return { message: "Password changed successfully" };
  }

  async validateUser(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }
}
