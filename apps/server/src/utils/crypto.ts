import crypto from 'crypto';

const SECRET_KEY = process.env.APP_SECRET || 'default-secret-key';

/**
 * Hash password using bcrypt-like approach with crypto
 * Production should use bcrypt instead
 */
export function hashPassword(password: string): string {
  // Using PBKDF2 for now, consider using bcrypt in production
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  return computedHash === storedHash;
}

/**
 * Hash token for secure storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Encrypt sensitive string (subscription URL)
 */
export function encryptString(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto
    .createHash('sha256')
    .update(SECRET_KEY)
    .digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  
  // Combine IV and encrypted data
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt sensitive string
 */
export function decryptString(encryptedText: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto
      .createHash('sha256')
      .update(SECRET_KEY)
      .digest();
    
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Failed to decrypt string');
  }
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Mask sensitive URL for display (show only first 20 chars and last 20 chars)
 */
export function maskUrl(url: string): string {
  if (url.length <= 40) {
    return url.substring(0, 10) + '...' + url.substring(url.length - 10);
  }
  return url.substring(0, 20) + '...' + url.substring(url.length - 20);
}
