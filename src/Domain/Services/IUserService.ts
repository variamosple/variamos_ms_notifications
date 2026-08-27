export interface IUserService {
  findUserIdsByRoles(roles: string[]): Promise<string[]>;
}
