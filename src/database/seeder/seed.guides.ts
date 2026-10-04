/**
 * Seeds the guided-meditation library (upsert by slug).
 *
 *   npm run seed:guides
 *
 * Bootstraps only Mongoose + the Guide model, so it runs independently of the
 * rest of the app.
 */
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DatabaseModule } from "../mongoose.module";
import {
  Guide,
  GuideDocument,
  GuideSchema,
} from "../../modules/guide/entity/guide.entity";
import { GUIDES } from "./data/guides.data";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    DatabaseModule,
    MongooseModule.forFeature([{ name: Guide.name, schema: GuideSchema }]),
  ],
})
class SeedGuidesModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedGuidesModule, {
    logger: ["error", "warn"],
  });
  const guideModel = app.get<Model<GuideDocument>>(getModelToken(Guide.name));

  try {
    let created = 0;
    let updated = 0;
    for (const guide of GUIDES) {
      const res = await guideModel.updateOne(
        { slug: guide.slug },
        { $set: { ...guide, isPublished: true } },
        { upsert: true },
      );
      if (res.upsertedCount) created += 1;
      else if (res.modifiedCount) updated += 1;
    }

    const total = await guideModel.countDocuments();
    console.log(`\n✅  Guides seeded — created ${created}, updated ${updated}`);
    console.log(`   total published guides: ${total}`);
    console.log(`\n   GET /api/guides\n`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
