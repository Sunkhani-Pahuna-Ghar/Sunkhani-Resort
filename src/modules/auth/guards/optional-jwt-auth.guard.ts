import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Attaches the user when a valid token is sent, but lets anonymous requests through. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(_err: unknown, user: any) {
    return user || null;
  }
}
