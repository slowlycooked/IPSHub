import { FastifyReply, FastifyRequest } from 'fastify';

export interface UserSession {
  userId: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      session?: UserSession;
    }
  }
}

// 简单的会话存储（生产环境应该用 Redis）
const sessions = new Map<string, UserSession>();

export async function setAuthCookie(reply: FastifyReply, sessionId: string, session: UserSession): Promise<void> {
  sessions.set(sessionId, session);
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  reply.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export async function getSessionFromRequest(request: FastifyRequest): Promise<UserSession | null> {
  const sessionId = request.cookies.sessionId;
  if (!sessionId) {
    return null;
  }
  return sessions.get(sessionId) || null;
}

export async function clearSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
}
