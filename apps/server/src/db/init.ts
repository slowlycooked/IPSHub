import { getDatabase } from './client';
import { createLogger } from '../utils/logger';
import { hashPassword } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('db-init');

export function initializeDatabase(): void {
  const db = getDatabase();
  
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // Check if admin user already exists
  const existingUser = db.users.getByUsername(adminUsername);

  if (!existingUser) {
    const userId = uuidv4();
    const passwordHash = hashPassword(adminPassword);
    const now = new Date().toISOString();

    db.users.insert({
      id: userId,
      username: adminUsername,
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    });

    logger.info(`Default admin user created: ${adminUsername}`);
  } else {
    logger.info('Admin user already exists');
  }
}
