import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, LogLevel } from "@nestjs/common";
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors();

  app.setGlobalPrefix("api");

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  setupSwagger(app);

  const port = process.env.PORT || 5000;
  await app.listen(port);

  Logger.log(
    `Application is running on: http://localhost:${port}/api`,
    "Bootstrap",
  );
}

bootstrap();
