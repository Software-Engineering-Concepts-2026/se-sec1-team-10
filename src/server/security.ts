import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';

const derive = promisify(scrypt);
export const SESSION_MS = 30 * 60 * 1000;
export const COOKIE_NAME = 'lb_session';

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, encoded] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'hex');
  const actual = await derive(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function tokenService(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    sign: (userId: string, sessionId: string, now: Date) => new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
      .setIssuer('lifebalance').setAudience('lifebalance-web')
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor((now.getTime() + SESSION_MS) / 1000)).sign(key),
    async verify(token: string, now: Date) {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'], issuer: 'lifebalance', audience: 'lifebalance-web', currentDate: now,
      });
      if (!payload.sub || typeof payload.sid !== 'string') throw new Error('Invalid session');
      return { userId: payload.sub, sessionId: payload.sid };
    },
  };
}
