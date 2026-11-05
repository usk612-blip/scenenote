import { createHmac, timingSafeEqual } from "node:crypto";

// 공유 접근 암호 방식의 핵심 로직.
// 필요한 환경 변수 (.env 또는 Vercel 환경 변수에만 둔다):
//   ACCESS_CODE    : 연출부가 입력하는 공유 접근 암호 (16자 이상, 길고 무작위로)
//   SESSION_SECRET : 쿠키 서명용 비밀 문자열 (32자 이상, 길고 무작위로, 접근 암호와 다르게)
// 둘 중 하나라도 없거나, 너무 짧거나, 서로 같으면 아무도 들어갈 수 없다. (안전한 쪽으로 닫힘)
// 틀린 횟수 제한은 서버 메모리에만 있어 완전한 방어가 아니므로, 암호가 길고 무작위인 것이 가장 중요하다.

export const ACCESS_COOKIE = "scenenote_access";
export const SESSION_SECONDS = 60 * 60 * 12; // 12시간
export const MIN_ACCESS_CODE_LENGTH = 16;
export const MIN_SESSION_SECRET_LENGTH = 32;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// 설정이 안전한 값인지 본다. 값 자체는 어디에도 출력하지 않는다.
export function isConfigured(): boolean {
  const code = process.env.ACCESS_CODE;
  const secret = process.env.SESSION_SECRET;
  if (!code || !secret) return false;
  if (code.length < MIN_ACCESS_CODE_LENGTH) return false;
  if (secret.length < MIN_SESSION_SECRET_LENGTH) return false;
  if (code === secret) return false; // 같은 값을 두 용도로 쓰지 않는다
  return true;
}

export function checkAccessCode(input: string): boolean {
  if (!isConfigured()) return false;
  const code = process.env.ACCESS_CODE as string;
  return safeEqual(input, code);
}

export function createSessionToken(): string {
  if (!isConfigured()) throw new Error("access settings are not valid");
  const secret = process.env.SESSION_SECRET as string;
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!isConfigured()) return false;
  const secret = process.env.SESSION_SECRET as string;
  if (!token) return false;
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
