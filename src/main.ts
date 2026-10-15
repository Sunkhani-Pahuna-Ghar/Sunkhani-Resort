import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, LogLevel } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./common/interceptors/transform-response.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { setupSwagger } from "./config/swagger.config";

async function bootstrap() {
  const isProd = process.env.NODE_ENV === "production";
  const logLevels: LogLevel[] = isProd
    ? ["log", "warn", "error"]
    : ["log", "warn", "error", "debug", "verbose"];

  const app = await NestFactory.create(AppModule, { logger: logLevels });

  // When the server sits behind a proxy (nginx, a hosting platform), set
  // TRUST_PROXY=1 so rate limiting sees the real visitor IP, not the proxy's.
  if (process.env.TRUST_PROXY) {
    app
      .getHttpAdapter()
      .getInstance()
      .set("trust proxy", Number(process.env.TRUST_PROXY));
  }

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Only our own website(s) may call the API from a browser.
  // CORS_ORIGINS=https://staysunkhani.com,https://www.staysunkhani.com
  const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.setGlobalPrefix("api");

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // API docs are for development only.
  if (!isProd) {
    setupSwagger(app);
  }

  const port = process.env.PORT || 5000;
  await app.listen(port);

  Logger.log(
    `Application is running on: http://localhost:${port}/api`,
    "Bootstrap",
  );
}

bootstrap();
