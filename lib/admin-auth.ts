import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "niubiz_admin";
const maxAge = 60 * 60 * 12;
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const secret = () => process.env.ADMIN_SESSION_SECRET || "";
const signature = (expires: string) => createHmac("sha256", secret()).update(expires).digest("hex");

export function verifyPassword(value: string) {
  const expected = process.env.ADMIN_PASSWORD || "";
  return Boolean(expected && secret() && safeEqual(value, expected));
}

export async function createAdminSession() {
  const expires = String(Math.floor(Date.now() / 1000) + maxAge);
  (await cookies()).set(COOKIE, `${expires}.${signature(expires)}`, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
}

export async function clearAdminSession() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function isAdmin() {
  if (!secret()) return false;
  const token = (await cookies()).get(COOKIE)?.value || "";
  const [expires, received] = token.split(".");
  if (!expires || !received || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(received, signature(expires));
}
