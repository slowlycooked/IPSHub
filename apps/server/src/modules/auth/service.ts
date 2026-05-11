import { z } from 'zod';
import { getDatabase } from '@/db/client';
import { verifyPassword, generateToken } from '@/utils/crypto';
import { createLogger } from '@/utils/logger';

const logger = createLogger('auth-service');

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  username: string;
}

export function loginUser(username: string, password: string): AuthUser | null {
  const db = getDatabase();
  const user = db.users.getByUsername(username);

  if (!user) {
    logger.warn(`Login attempt for non-existent user: ${username}`);
    return null;
  }

  if (!verifyPassword(password, user.password_hash)) {
    logger.warn(`Failed login attempt for user: ${username}`);
    return null;
  }

  logger.info(`User logged in: ${username}`);
  return { id: user.id, username: user.username };
}

export function generateSessionId(): string {
  return generateToken(32);
}
