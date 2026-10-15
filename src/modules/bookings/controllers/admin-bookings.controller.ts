import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { BookingsService } from "../bookings.service";
import {
  AdminBookingsQueryDto,
  UpdateBookingStatusDto,
} from "../dto/booking-queries.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { Role } from "../../auth/enum/role.enum";
import { ParseObjectIdPipe } from "../../../common/pipes/parse-object-id.pipe";

@Controller("admin/bookings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@Query() query: AdminBookingsQueryDto) {
    return this.bookings.findAll(query.status);
  }

  @Patch(":id")
  update(
    @Param("id", ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookings.updateStatus(id, dto.status);
  }
}
