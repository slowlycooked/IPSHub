import { getDatabase, withTransaction } from './client';
import { createLogger } from '../utils/logger';
import { hashPassword } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('db-init');

export function initializeDatabase(): void {
  const db = getDatabase();
  
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // Check if admin user already exists
  const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);

  if (!existingUser) {
    withTransaction((database) => {
      const userId = uuidv4();
      const passwordHash = hashPassword(adminPassword);
      const now = Date.now();

      database.prepare(`
        INSERT INTO users (id, username, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, adminUsername, passwordHash, now, now);

      logger.info(`Default admin user created: ${adminUsername}`);
    });
  } else {
    logger.info('Admin user already exists');
  }
}

