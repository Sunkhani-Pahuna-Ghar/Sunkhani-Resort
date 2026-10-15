import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST");
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get("SMTP_PORT") || 587),
        secure: this.config.get("SMTP_SECURE") === "true",
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASS"),
        },
      });
    } else {
      this.logger.warn("SMTP_HOST not set: emails are logged, not sent");
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      const isProd = process.env.NODE_ENV === "production";
      this.logger.log(
        isProd ? `(email not sent) to=${to} subject=${subject}` : `(email not sent) to=${to} subject=${subject}\n${text}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>("MAIL_FROM") || this.config.get<string>("SMTP_USER"),
      to,
      subject,
      text,
    });
  }

  async sendPasswordResetEmail(to: string, tempPassword: string, expiresAt: Date): Promise<void> {
    await this.send(
      to,
      "Your temporary password",
      `Your temporary password is: ${tempPassword}\nIt expires at ${expiresAt.toISOString()}.`,
    );
  }
}
