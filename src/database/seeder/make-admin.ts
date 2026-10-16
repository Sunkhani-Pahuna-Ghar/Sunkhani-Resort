/**
 * Gives an existing account the ADMIN role.
 *   npm run make-admin -- someone@example.com
 * The person must already have signed up through the website.
 * This is the only way to create an admin; the API never does it.
 */
import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AppModule } from "../../app.module";
import { User, UserDocument } from "../../modules/auth/entity/user.entity";
import { Role } from "../../modules/auth/enum/role.enum";

async function bootstrap() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run make-admin -- someone@example.com");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const result = await userModel.updateOne({ email }, { role: Role.ADMIN });

    if (result.matchedCount === 0) {
      console.error(`No account found for ${email}. Sign up on the site first.`);
      process.exitCode = 1;
    } else {
      console.log(`${email} is now an admin.`);
    }
  } finally {
    await app.close();
  }
}

void bootstrap();
