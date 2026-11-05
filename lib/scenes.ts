// 대본에서 씬 머리글을 찾아 낮/밤을 구분한다. (AI를 쓰지 않는 규칙 기반)
// 규칙 (PRD 5. must 1):
//  - 대본에 적힌 씬 머리글(예: "S#3. 카페 / 낮")만 근거로 삼는다.
//  - 낮/밤을 머리글에서 알 수 없으면 추측하지 않고 "불명"으로 둔다.
//  - 씬 번호는 대본의 번호를 그대로 쓴다. 새로 만들거나 고치지 않는다.
//  - 씬마다 근거가 된 머리글 원문을 함께 돌려준다.

export type TimeOfDay = "낮" | "밤" | "불명";

export type Scene = {
  number: string; // 대본에 적힌 씬 번호 그대로 (예: "3", "12A")
  place: string; // 장소 (머리글에서 시간·날짜를 뺀 부분)
  time: TimeOfDay;
  date: string | null; // 머리글에 날짜 표시(D+1, 2일차 등)가 있을 때만
  evidence: string; // 근거가 된 머리글 원문
  line: number; // 대본 안의 줄 번호 (1부터)
};

export type SceneResult = {
  scenes: Scene[];
  duplicateNumbers: string[]; // 같은 번호가 두 번 이상 나온 경우 알려 준다
  summary: { 낮: number; 밤: number; 불명: number; total: number };
};

// "S#3.", "#3", "SC.3", "SC 3", "씬3", "씬 3", "Scene 3" 로 시작하는 줄
// 씬 번호는 숫자 + (바로 붙은) 영문 한 글자까지만이다. (예: 3, 12A)
// 번호 뒤에 띄어쓰기를 두고 오는 글자(예: "S#3 N 골목"의 N)는 번호가 아니다.
const HEADER = /^\s*(?:S\s*#|#|SC\.?\s*|씬\s*|scene\s*)(\d+(?:[A-Za-z](?![A-Za-z]))?)\s*[.\-:)\]]?\s*(.*)$/i;

const DAY_WORDS = ["낮", "아침", "오전", "오후", "점심", "한낮", "DAY"];
const NIGHT_WORDS = ["밤", "저녁", "새벽", "심야", "야간", "NIGHT"];
const SEP = String.raw`[\s/|,.·\-()\[\]]`;

const DATE_PATTERNS: RegExp[] = [
  /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/, // 2026.11.05, 2026년 11월 5일
  /\d{1,2}\s*월\s*\d{1,2}\s*일/, // 11월 5일
  /D\s*[+\-]\s*\d+/i, // D+1
  /\d+\s*일\s*차/, // 2일차
  /Day\s*\d+/i, // Day 2
];

function findDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function hasWord(text: string, words: string[]): boolean {
  return words.some((word) => {
    // 한글은 단어 경계가 없으므로 포함 여부로, 영문은 앞뒤가 구분자일 때만 본다.
    if (/[가-힣]/.test(word)) return text.includes(word);
    return new RegExp(`(^|${SEP})${word}($|${SEP})`, "i").test(text);
  });
}

function findTime(text: string): TimeOfDay {
  // 한 줄에 낮/밤이 모두 있으면(예: "낮→밤") 어느 쪽인지 추측하지 않는다.
  // 날짜 표시(D+1, Day 2, 2일차 등)는 낮/밤 판정에서 먼저 뺀다. ("Day 2"의 Day를 낮으로 읽지 않기 위해)
  let stripped = text;
  for (const pattern of DATE_PATTERNS) {
    stripped = stripped.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`), " ");
  }
  const day = hasWord(stripped, DAY_WORDS) || new RegExp(`(^|${SEP})D($|${SEP})`).test(stripped);
  const night = hasWord(stripped, NIGHT_WORDS) || new RegExp(`(^|${SEP})N($|${SEP})`).test(stripped);
  if (day && !night) return "낮";
  if (night && !day) return "밤";
  return "불명";
}

function cleanPlace(text: string): string {
  let place = text;
  for (const pattern of DATE_PATTERNS) place = place.replace(pattern, " ");
  for (const word of [...DAY_WORDS, ...NIGHT_WORDS]) {
    place = /[가-힣]/.test(word)
      ? place.replaceAll(word, " ")
      : place.replace(new RegExp(`(^|${SEP})${word}(?=$|${SEP})`, "gi"), " ");
  }
  place = place.replace(new RegExp(`(^|${SEP})[DN](?=$|${SEP})`, "g"), " ");
  return place
    .replace(/[/|,·()\[\]→>~]+/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.\-:]+|[\s.\-:]+$/g, "");
}

export function analyzeScenes(script: string): SceneResult {
  const lines = script.replace(/\r\n?/g, "\n").split("\n");
  const scenes: Scene[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.length > 200) return; // 머리글은 짧다. 긴 줄은 지문·대사로 본다.
    const match = line.match(HEADER);
    if (!match) return;
    const number = match[1].replace(/\s+/g, "");
    const rest = match[2];
    scenes.push({
      number,
      place: cleanPlace(rest),
      time: findTime(rest),
      date: findDate(rest),
      evidence: line,
      line: index + 1,
    });
  });

  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const scene of scenes) {
    if (seen.has(scene.number)) dup.add(scene.number);
    seen.add(scene.number);
  }

  const summary = { 낮: 0, 밤: 0, 불명: 0, total: scenes.length };
  for (const scene of scenes) summary[scene.time] += 1;

  return { scenes, duplicateNumbers: [...dup], summary };
}
