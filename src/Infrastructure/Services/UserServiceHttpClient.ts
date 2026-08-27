import { Injectable } from "@nestjs/common";
import { IUserService } from "../../Domain/Services/IUserService.js";

@Injectable()
export class UserServiceHttpClient implements IUserService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async findUserIdsByRoles(roles: string[]): Promise<string[]> {
    // Stub returning simulated user IDs based on requested roles
    if (roles.includes("administrator")) {
      return ["admin-1", "admin-2"];
    }
    return ["user-1", "user-2"];
  }
}
