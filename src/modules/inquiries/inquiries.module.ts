import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MailModule } from "../mail/mail.module";
import { Inquiry, InquirySchema } from "./entity/inquiry.entity";
import { InquiriesService } from "./inquiries.service";
import {
  AdminInquiriesController,
  InquiriesController,
} from "./controllers/inquiries.controller";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inquiry.name, schema: InquirySchema }]),
    MailModule,
  ],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
