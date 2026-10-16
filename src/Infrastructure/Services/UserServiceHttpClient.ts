import { Injectable } from "@nestjs/common";
import { IUserService } from "../../Domain/Services/IUserService.js";

/**
 * Role resolution is not available in this service: the admin service
 * resolves roles into user ids before sending (EV-99, CA-NT-02, option a).
 * It used to return made-up ids; it now fails instead of notifying wrong
 * recipients.
 */
@Injectable()
export class UserServiceHttpClient implements IUserService {
  public async findUserIdsByRoles(_roles: string[]): Promise<string[]> {
    throw new Error(
      "Role resolution is not available: send user ids resolved by the admin service.",
    );
  }
}
