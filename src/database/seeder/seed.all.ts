/**
 * Full reset seed — everything needed to exercise every API.
 *
 *   npm run seed:all
 *
 * DESTRUCTIVE: wipes users, guides and meditation sessions, then creates:
 *   • one demo user   (SEED_EMAIL / SEED_PASSWORD, defaults below)
 *   • the guide library (src/database/seeder/data/guides.data.ts)
 *   • ~3 weeks of that user's sessions — a 12-day current streak, mixed
 *     types, guide-linked guided sessions, and logged moods.
 *
 * Bootstraps only Mongoose + the three models, so it runs independently of
 * the rest of the app.
 */
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { DatabaseModule } from "../mongoose.module";
import {
  User,
  UserDocument,
  UserSchema,
} from "../../modules/auth/entity/user.entity";
import { Status } from "../../modules/auth/enum/user.enum";
import {
  Guide,
  GuideDocument,
  GuideSchema,
} from "../../modules/guide/entity/guide.entity";
import {
  MeditationSession,
  MeditationSessionSchema,
  SessionDocument,
} from "../../modules/session/entity/session.entity";
import { SessionType } from "../../modules/session/enum/session.enum";
import { Mood } from "../../shared/enums/mood.enum";
import { GUIDES } from "./data/guides.data";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Guide.name, schema: GuideSchema },
      { name: MeditationSession.name, schema: MeditationSessionSchema },
    ]),
  ],
})
class SeedAllModule {}

const SEED_EMAIL = process.env.SEED_EMAIL || "alex@still.app";
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Meditation123!";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedAllModule, {
    logger: ["error", "warn"],
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const guideModel = app.get<Model<GuideDocument>>(getModelToken(Guide.name));
  const sessionModel = app.get<Model<SessionDocument>>(
    getModelToken(MeditationSession.name),
  );

  try {
    // ── Reset ────────────────────────────────────────────────────────────────
    await Promise.all([
      sessionModel.deleteMany({}),
      guideModel.deleteMany({}),
      userModel.deleteMany({}),
    ]);

    // ── Demo user ────────────────────────────────────────────────────────────
    const user = await userModel.create({
      email: SEED_EMAIL,
      password: await bcrypt.hash(SEED_PASSWORD, 10),
      firstName: "Alex",
      lastName: null,
      isTempPassword: false,
      status: Status.ACTIVE,
    });

    // ── Guides ───────────────────────────────────────────────────────────────
    const guides = await guideModel.insertMany(
      GUIDES.map((g) => ({ ...g, isPublished: true })),
    );
    const bySlug = new Map(guides.map((g) => [g.slug, g]));

    // ── Sessions ─────────────────────────────────────────────────────────────
    // UTC-day anchored so they bucket cleanly under the default `/home` tz.
    const now = new Date();
    const at = (dayOffset: number, hour: number, minute: number): Date => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - dayOffset);
      d.setUTCHours(hour, minute, 0, 0);
      return d.getTime() > now.getTime()
        ? new Date(now.getTime() - 5 * 60_000)
        : d;
    };

    type Opts = {
      durationSeconds?: number;
      slug?: string;
      mood?: Mood;
      note?: string;
    };
    const row = (
      dayOffset: number,
      hour: number,
      minute: number,
      type: SessionType,
      opts: Opts,
    ) => {
      const guide = opts.slug ? bySlug.get(opts.slug) : undefined;
      const durationSeconds =
        opts.durationSeconds ?? guide?.durationSeconds ?? 600;
      const completedAt = at(dayOffset, hour, minute);
      return {
        user: user._id,
        type,
        durationSeconds,
        guideId: guide?._id ?? null,
        guide: guide?.title ?? null,
        mood: opts.mood ?? guide?.mood ?? null,
        startedAt: new Date(completedAt.getTime() - durationSeconds * 1000),
        completedAt,
        note: opts.note ?? null,
      };
    };

    const G = SessionType.GUIDED;
    const T = SessionType.TIMER;
    const S = SessionType.STOPWATCH;

    const rows = [
      // ── Last 12 days → current streak of 12, ending today ──────────────────
      row(0, 4, 2, G, { slug: "breathe-in-calm", mood: Mood.CALM }),
      row(1, 21, 15, T, { durationSeconds: 1200, mood: Mood.FOCUSED }),
      row(2, 8, 30, S, { durationSeconds: 900, mood: Mood.NEUTRAL }),
      row(3, 7, 45, G, { slug: "body-scan", mood: Mood.TIRED }),
      row(4, 22, 0, T, { durationSeconds: 1500, mood: Mood.CALM }),
      row(5, 8, 0, G, { slug: "morning-focus" }),
      row(6, 7, 30, T, { durationSeconds: 480 }),
      row(7, 20, 10, G, { slug: "loving-kindness", mood: Mood.HAPPY }),
      row(8, 6, 50, S, { durationSeconds: 660, mood: Mood.NEUTRAL }),
      row(9, 7, 15, G, { slug: "ground-anxiety", mood: Mood.ANXIOUS }),
      row(10, 21, 40, T, { durationSeconds: 1080, mood: Mood.CALM }),
      row(11, 8, 5, G, { slug: "let-go-of-stress", mood: Mood.STRESSED }),
      // ── Gap at day 12–13, then older history (longest streak = 3) ─────────
      row(14, 7, 0, G, { slug: "breathe-in-calm" }),
      row(15, 7, 0, T, { durationSeconds: 1200, mood: Mood.FOCUSED }),
      row(16, 7, 0, G, { slug: "evening-wind-down" }),
      row(18, 7, 0, S, { durationSeconds: 840 }),
      row(20, 7, 0, G, { slug: "body-scan", mood: Mood.TIRED }),
    ];

    const sessions = await sessionModel.insertMany(rows);

    // ── Summary ──────────────────────────────────────────────────────────────
    const line = "─".repeat(64);
    console.log(`\n✅  Seed complete\n${line}`);
    console.log(`Demo user   ${SEED_EMAIL}  /  ${SEED_PASSWORD}`);
    console.log(`Guides      ${guides.length}`);
    console.log(`Sessions    ${sessions.length}  (current streak: 12 days)`);
    console.log(line);
    console.log(`
Try it:
  TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \\
    -H 'Content-Type: application/json' \\
    -d '{"email":"${SEED_EMAIL}","password":"${SEED_PASSWORD}"}' | jq -r .data.accessToken)

  curl -s http://localhost:5000/api/home                 -H "Authorization: Bearer $TOKEN"
  curl -s http://localhost:5000/api/sessions/get-user    -H "Authorization: Bearer $TOKEN"
  curl -s http://localhost:5000/api/sessions/moods       -H "Authorization: Bearer $TOKEN"
  curl -s http://localhost:5000/api/guides               -H "Authorization: Bearer $TOKEN"
  curl -s http://localhost:5000/api/guides/moods         -H "Authorization: Bearer $TOKEN"
  curl -s http://localhost:5000/api/guides/breathe-in-calm -H "Authorization: Bearer $TOKEN"
`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
