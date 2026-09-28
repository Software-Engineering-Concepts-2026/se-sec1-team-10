import type { RequestHandler } from "express";
import type { PublicUser } from "../../shared/contracts.js";
import type { AiConfiguration } from "../ai.js";
import type { NutritionConfiguration } from "../nutrition.js";
import type { Repository } from "../repository.js";
import { COOKIE_NAME, SESSION_MS, tokenService } from "../security.js";

export type RouteContext = {
  repository: Repository;
  config: { ai?: AiConfiguration; nutrition?: NutritionConfiguration };
  now: () => Date;
  tokens: ReturnType<typeof tokenService>;
  cookieOptions: {
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    path: string;
  };
  publicUser: (user: Omit<PublicUser, "bmi">) => PublicUser;
};

export function createRequireAuth(context: RouteContext): RequestHandler {
  const { repository, now, tokens, cookieOptions } = context;

  return async (req, res, next) => {
    let identity;
    try {
      identity = await tokens.verify(req.cookies[COOKIE_NAME] ?? "", now());
    } catch {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.status(401).json({ message: "กรุณาเข้าสู่ระบบอีกครั้ง" });
      return;
    }

    const date = now();
    const active = await repository.touchSession(
      identity.sessionId,
      identity.userId,
      date,
      new Date(date.getTime() + SESSION_MS),
    );
    const user = active ? await repository.findUserById(identity.userId) : null;
    if (!user) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res
        .status(401)
        .json({ message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" });
      return;
    }

    res.locals.user = user;
    res.locals.sessionId = identity.sessionId;
    res.cookie(
      COOKIE_NAME,
      await tokens.sign(user.id, identity.sessionId, date),
      { ...cookieOptions, maxAge: SESSION_MS },
    );
    next();
  };
}
