import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class VerifyTempPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  tempPassword!: string;

  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}
