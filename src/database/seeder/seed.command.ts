import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { User, UserDocument } from "../../modules/auth/entity/user.entity";
import { Status } from "../../modules/auth/enum/user.enum";

const SEED_EMAIL = process.env.SEED_EMAIL || "admin@meditation.local";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  try {
    const existing = await userModel.findOne({ email: SEED_EMAIL });

    if (existing) {
      console.log("Seed user already exists:", existing.email);
      await app.close();
      return;
    }

    const tempPassword = "Meditation123!";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const user = new userModel({
      email: SEED_EMAIL,
      password: hashedPassword,
      status: Status.ACTIVE,
      isTempPassword: true,
      tempPassword: tempPassword,
      tempPasswordExpiresAt: expiresAt,
    });

    await user.save();

    console.log("\n🎉 Seed user created successfully!");
    console.log("==========================================");
    console.log("Email:", SEED_EMAIL);
    console.log("Temporary Password:", tempPassword);
    console.log("Expires:", expiresAt.toLocaleString());
    console.log("==========================================");
    console.log(
      "⚠️  Please change this password immediately after first login\n",
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
