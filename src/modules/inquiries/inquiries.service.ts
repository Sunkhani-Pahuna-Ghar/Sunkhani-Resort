import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { MailService } from "../mail/mail.service";
import { Inquiry, InquiryDocument } from "./entity/inquiry.entity";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    @InjectModel(Inquiry.name)
    private readonly inquiryModel: Model<InquiryDocument>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateInquiryDto) {
    const inquiry = await this.inquiryModel.create({
      name: dto.name,
      email: dto.email,
      message: dto.message,
      status: "new",
    });

    void this.notifyOwner(inquiry);
    return { id: String(inquiry._id), message: "Thank you. We will reply soon." };
  }

  async findAll() {
    const rows = await this.inquiryModel
      .find()
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return rows.map((i) => ({
      id: String(i._id),
      name: i.name,
      email: i.email,
      message: i.message,
      status: i.status,
      createdAt: (i as any).createdAt,
    }));
  }

  private async notifyOwner(i: InquiryDocument) {
    const owner = this.config.get<string>("OWNER_EMAIL");
    if (!owner) {
      this.logger.warn("OWNER_EMAIL is not set: no email sent for new inquiry");
      return;
    }
    try {
      await this.mail.send(
        owner,
        `New message from ${i.name}`,
        `From: ${i.name} <${i.email}>\n\n${i.message}`,
      );
    } catch (err) {
      this.logger.error(`Inquiry email failed: ${String(err)}`);
    }
  }
}
