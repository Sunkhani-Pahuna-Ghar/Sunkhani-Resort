import { Controller, Post, Patch, Body, UseGuards, Get } from "@nestjs/common";
import { AuthService } from "../service/auth.service";
import { LoginDto } from "../dto/login.dto";
import { VerifyTempPasswordDto } from "../dto/verify-temp-pswd.dto";
import { ResetPasswordDto } from "../dto/reset-pswd.dto";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";
import type { UserPayload } from "../../../shared/types/user-payload.type";
import { CreateUserDto } from "../dto/create-user.dto";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("verify-temp-password")
  async verifyTempPassword(@Body() verifyDto: VerifyTempPasswordDto) {
    return this.authService.verifyTempPasswordAndSetNew(verifyDto);
  }

  @Post("reset-password")
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@CurrentUser() user: UserPayload) {
    return this.authService.getProfile(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  updateProfile(
    @CurrentUser() user: UserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  changePassword(
    @CurrentUser() user: UserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }
}
