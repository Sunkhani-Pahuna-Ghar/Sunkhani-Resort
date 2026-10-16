import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enum/role.enum";
import type { UserPayload } from "../../../shared/types/user-payload.type";

/** Use together with JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: UserPayload }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("You do not have access to this resource");
    }
    return true;
  }
}
