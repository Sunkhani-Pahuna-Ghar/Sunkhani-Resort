import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { cleanEmail, cleanLine, cleanMultiline } from "../../../common/utils/text.util";

export class CreateInquiryDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }) => cleanEmail(value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }) => cleanMultiline(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
