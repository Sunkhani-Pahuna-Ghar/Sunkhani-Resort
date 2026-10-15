import { Role } from "../../modules/auth/enum/role.enum";

export type UserPayload = {
  userId: string;
  email: string;
  role: Role;
};
