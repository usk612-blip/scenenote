"use client";

import { useState } from "react";

type Character = { name: string; lines: number; major: boolean; personality: string; scenes: string[] };
type Relation = { a: string; b: string; relation: string; scenes: string[] };
type Result = { characters: Character[]; relations: Relation[]; droppedByCheck: number };

function Graph({ characters, relations }: { characters: Character[]; relations: Relation[] }) {
  const size = 520;
  const center = size / 2;
  const radius = size / 2 - 70;
  const points = new Map(
    characters.map((c, i) => {
      const angle = (2 * Math.PI * i) / characters.length - Math.PI / 2;
      return [c.name, { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }];
    }),
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="인물관계도" className="mx-auto w-full max-w-xl">
      {relations.map((r, i) => {
        const a = points.get(r.a);
        const b = points.get(r.b);
        if (!a || !b) return null;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a1a1aa" strokeWidth={1.5} />
            <text
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              textAnchor="middle"
              fontSize={11}
              fill="#52525b"
              stroke="#fff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {r.relation.length > 12 ? `${r.relation.slice(0, 12)}…` : r.relation}
            </text>
          </g>
        );
      })}
      {characters.map((c) => {
        const p = points.get(c.name)!;
        return (
          <g key={c.name}>
            <circle cx={p.x} cy={p.y} r={c.major ? 30 : 22} fill={c.major ? "#18181b" : "#e4e4e7"} />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={12}
              fill={c.major ? "#fff" : "#18181b"}
            >
              {c.name.length > 5 ? `${c.name.slice(0, 5)}…` : c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// 대본은 동의했을 때만 외부 AI 서비스로 보낸다. 결과는 이 화면의 메모리에만 둔다.
export function CharacterPanel({ buildBody, disabled }: { buildBody: () => FormData; disabled: boolean }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "x-ai-consent": "yes" },
        body: buildBody(),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.location.reload();
          return;
        }
        setError(data.error ?? "인물을 정리하지 못했습니다.");
        return;
      }
      setResult(data as Result);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12 border-t border-zinc-300 pt-8 dark:border-zinc-700">
      <h2 className="text-xl font-semibold text-black dark:text-zinc-50">인물관계도와 인물 성격</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        인물 목록과 대사 줄 수는 프로그램이 직접 세고, 관계와 성격 설명만 AI 서비스(Anthropic)가 만듭니다.
        근거가 되는 씬 번호가 없는 내용은 &quot;정보 부족&quot;으로 표시하거나 버립니다.
      </p>

      <label className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>대본 전체가 외부 AI 서비스(Anthropic)로 전송</strong>됩니다. 대외비 대본이라면 사용 약관(입력 내용
          학습 여부, 보관 기간)을 확인한 뒤에만 체크해 주세요.
        </span>
      </label>

      <button
        type="button"
        onClick={run}
        disabled={!consent || busy || disabled}
        className="mt-4 rounded-md bg-black px-5 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {busy ? "정리 중… (최대 1~2분)" : "인물 정리하기"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8" aria-live="polite">
          {result.droppedByCheck > 0 && (
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              AI 답변 중 대본에서 확인되지 않은 {result.droppedByCheck}개 항목은 버렸습니다.
            </p>
          )}
          <Graph characters={result.characters} relations={result.relations} />
          <p className="mt-2 text-center text-xs text-zinc-500">큰 검은 원: 대사 3줄 이상인 주요 인물</p>

          <h3 className="mt-8 font-semibold text-black dark:text-zinc-50">인물</h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-b border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              <tr>
                <th className="py-2 pr-4">이름</th>
                <th className="py-2 pr-4">대사</th>
                <th className="py-2 pr-4">성격</th>
                <th className="py-2">근거 씬</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900 dark:text-zinc-100">
              {result.characters.map((c) => (
                <tr key={c.name} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4">{c.lines}줄</td>
                  <td className={`py-2 pr-4 ${c.personality === "정보 부족" ? "text-amber-700" : ""}`}>
                    {c.personality}
                  </td>
                  <td className="py-2">{c.scenes.length ? c.scenes.map((s) => `S#${s}`).join(", ") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-8 font-semibold text-black dark:text-zinc-50">관계</h3>
          {result.relations.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">대본에서 확인된 관계가 없습니다.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead className="border-b border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">인물</th>
                  <th className="py-2 pr-4">관계</th>
                  <th className="py-2">근거 씬</th>
                </tr>
              </thead>
              <tbody className="text-zinc-900 dark:text-zinc-100">
                {result.relations.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4">
                      {r.a} ↔ {r.b}
                    </td>
                    <td className="py-2 pr-4">{r.relation}</td>
                    <td className="py-2">{r.scenes.map((s) => `S#${s}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
