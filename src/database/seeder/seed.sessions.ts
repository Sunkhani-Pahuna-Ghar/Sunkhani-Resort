/**
 * Seeds meditation sessions for a single user so the Home screen has data.
 *
 *   npm run seed:sessions -- <user-email>
 *
 * Produces a 12-day current streak ending today plus some older sessions, and a
 * "Recent sessions" list that mirrors the Home mock.
 *
 * Bootstraps only Mongoose + the two models it needs, so it runs independently
 * of the rest of the app.
 */
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DatabaseModule } from "../mongoose.module";
import {
  User,
  UserDocument,
  UserSchema,
} from "../../modules/auth/entity/user.entity";
import {
  MeditationSession,
  MeditationSessionSchema,
  SessionDocument,
} from "../../modules/session/entity/session.entity";
import { SessionType } from "../../modules/session/enum/session.enum";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: MeditationSession.name, schema: MeditationSessionSchema },
    ]),
  ],
})
class SeedSessionsModule {}

const GUIDES = [
  "Morning Calm",
  "Body Scan",
  "Breath Focus",
  "Evening Wind Down",
  "Loving Kindness",
];

async function bootstrap() {
  const email = (process.argv[2] || process.env.SEED_EMAIL || "").trim();
  if (!email) {
    console.error("Usage: npm run seed:sessions -- <user-email>");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedSessionsModule, {
    logger: ["error", "warn"],
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const sessionModel = app.get<Model<SessionDocument>>(
    getModelToken(MeditationSession.name),
  );

  try {
    const user = await userModel.findOne({ email });
    if (!user) throw new Error(`No user found with email "${email}"`);

    const now = new Date();
    // Anchor to UTC calendar days so the sessions bucket cleanly under the
    // default `/api/home` timezone (UTC). Pass `?tz=` on the API to re-bucket.
    const at = (dayOffset: number, hour: number, minute: number): Date => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - dayOffset);
      d.setUTCHours(hour, minute, 0, 0);
      // Never place a "completed" session in the future (matters for today).
      return d.getTime() > now.getTime()
        ? new Date(now.getTime() - 5 * 60_000)
        : d;
    };
    const row = (
      dayOffset: number,
      hour: number,
      minute: number,
      type: SessionType,
      minutes: number,
      guideIdx = 0,
    ) => {
      const completedAt = at(dayOffset, hour, minute);
      return {
        user: user._id,
        type,
        durationSeconds: minutes * 60,
        guide: type === SessionType.GUIDED ? GUIDES[guideIdx] : null,
        startedAt: new Date(completedAt.getTime() - minutes * 60_000),
        completedAt,
        note: null,
      };
    };

    const rows = [
      // ── Last 12 days → current streak of 12, ending today ──────────────────
      row(0, 4, 2, SessionType.GUIDED, 10, 0),
      row(1, 21, 15, SessionType.TIMER, 20),
      row(2, 8, 30, SessionType.STOPWATCH, 15),
      row(3, 7, 45, SessionType.GUIDED, 10, 1),
      row(4, 22, 0, SessionType.TIMER, 25),
      row(5, 8, 0, SessionType.GUIDED, 12, 2),
      row(6, 7, 30, SessionType.TIMER, 8),
      row(7, 20, 10, SessionType.GUIDED, 15, 3),
      row(8, 6, 50, SessionType.STOPWATCH, 11),
      row(9, 7, 15, SessionType.GUIDED, 10, 4),
      row(10, 21, 40, SessionType.TIMER, 18),
      row(11, 8, 5, SessionType.GUIDED, 9, 0),
      // ── Gap at day 12–13, then older history ──────────────────────────────
      row(14, 7, 0, SessionType.GUIDED, 10, 1),
      row(15, 7, 0, SessionType.TIMER, 20),
      row(16, 7, 0, SessionType.GUIDED, 12, 2),
      row(18, 7, 0, SessionType.STOPWATCH, 14),
      row(20, 7, 0, SessionType.GUIDED, 25, 3),
    ];

    const removed = await sessionModel.deleteMany({ user: user._id });
    const inserted = await sessionModel.insertMany(rows);

    console.log(`\n✅  Seeded sessions for ${email}`);
    console.log(`   removed:  ${removed.deletedCount}`);
    console.log(`   inserted: ${inserted.length}`);
    console.log(`   expected current streak: 12 days`);
    console.log(`\n   GET /api/home   (Bearer token for ${email})\n`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
