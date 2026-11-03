import { ConflictException, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { Database } from "../config/drizzle/database.js";
import type { NewUser, User } from "../config/drizzle/schemas/index.js";

import { InjectDatabase, isUniqueViolation } from "../config/drizzle/database.js";
import { users } from "../config/drizzle/schemas/index.js";

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async create(user: NewUser): Promise<User> {
    try {
      const [created] = await this.db
        .insert(users)
        .values({ ...user, email: normalizeEmail(user.email) })
        .returning();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)))
      .limit(1);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }
}
