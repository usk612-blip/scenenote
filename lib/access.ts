import { createHmac, timingSafeEqual } from "node:crypto";

// 공유 접근 암호 방식의 핵심 로직.
// 필요한 환경 변수 (.env 또는 Vercel 환경 변수에만 둔다):
//   ACCESS_CODE    : 연출부가 입력하는 공유 접근 암호
//   SESSION_SECRET : 쿠키 서명용 비밀 문자열 (길고 무작위로, 접근 암호와 다르게)
// 둘 중 하나라도 없으면 아무도 들어갈 수 없다. (안전한 쪽으로 닫힘)

export const ACCESS_COOKIE = "scenenote_access";
export const SESSION_SECONDS = 60 * 60 * 12; // 12시간

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isConfigured(): boolean {
  return Boolean(process.env.ACCESS_CODE && process.env.SESSION_SECRET);
}

export function checkAccessCode(input: string): boolean {
  const code = process.env.ACCESS_CODE;
  if (!code) return false;
  return safeEqual(input, code);
}

export function createSessionToken(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires, secret))) return false;
  return Number(expires) > Date.now();
}

// --- 암호 오입력 횟수 제한 (IP 기준) ---
// 서버 메모리에 저장하므로 서버가 재시작되거나 여러 인스턴스로 나뉘면
// 초기화될 수 있다. 완전한 차단이 아니라 무작위 대입을 늦추는 장치다.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

export function lockRemainingSeconds(ip: string): number {
  const entry = attempts.get(ip);
  if (!entry) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining > 0) return Math.ceil(remaining / 1000);
  if (entry.lockedUntil > 0) attempts.delete(ip); // 잠금 시간이 지났으면 초기화
  return 0;
}

export function recordFailure(ip: string): void {
  const entry = attempts.get(ip) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.failures = 0;
  }
  attempts.set(ip, entry);
}

export function recordSuccess(ip: string): void {
  attempts.delete(ip);
}
