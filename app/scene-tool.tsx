"use client";

import { useState } from "react";
import { CharacterPanel } from "./character-panel";

type Scene = {
  number: string;
  place: string;
  time: "낮" | "밤" | "불명";
  date: string | null;
  evidence: string;
  line: number;
};

type Result = {
  scenes: Scene[];
  duplicateNumbers: string[];
  summary: { 낮: number; 밤: number; 불명: number; total: number };
  warning?: string;
};

type Filter = "전체" | "낮" | "밤" | "불명";

// 대본과 결과는 이 화면의 메모리에만 있다. 브라우저 저장소에는 쓰지 않는다.
export function SceneTool() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("전체");

  function buildBody() {
    const body = new FormData();
    if (file) body.append("file", file);
    else body.append("text", text);
    return body;
  }

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setFilter("전체");
    try {
      const response = await fetch("/api/scenes", { method: "POST", body: buildBody() });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.location.reload(); // 접근 시간이 끝났으면 암호 화면으로 돌아간다.
          return;
        }
        setError(data.error ?? "분석하지 못했습니다.");
        return;
      }
      setResult(data as Result);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const visible = result?.scenes.filter((s) => filter === "전체" || s.time === filter) ?? [];
  const canRun = !busy && (file !== null || text.trim().length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-5xl font-bold text-black dark:text-zinc-50">씬노트</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          대본의 씬 머리글(예: <code>S#3. 카페 / 낮</code>)을 읽어 낮/밤별로 정리합니다.
          대본은 저장되지 않고 이 화면을 닫으면 사라집니다. 씬 정리는 외부로 보내지 않지만, 아래 인물 정리는
          동의했을 때만 대본을 외부 AI 서비스로 보냅니다.
        </p>
      </header>

      <form onSubmit={run} className="mt-8 space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            파일 올리기 (.txt, .docx, .pdf · 5MB 이하)
          </label>
          <input
            id="file"
            type="file"
            accept=".txt,.docx,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 dark:text-zinc-300"
          />
        </div>
        <div>
          <label htmlFor="text" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            또는 대본 붙여넣기
          </label>
          <textarea
            id="text"
            rows={8}
            value={text}
            disabled={file !== null}
            onChange={(e) => setText(e.target.value)}
            placeholder={file ? "파일을 올렸습니다. 붙여넣기를 쓰려면 파일을 지워 주세요." : ""}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={!canRun}
          className="rounded-md bg-black px-5 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {busy ? "분석 중…" : "씬 정리하기"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="mt-10" aria-live="polite">
          {result.summary.total === 0 ? (
            <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
              씬 머리글을 찾지 못했습니다. 씬 번호로 시작하는 줄(예: <code>S#1. 거실 / 낮</code>,{" "}
              <code>#2 학교 - 밤</code>, <code>씬3 병원</code>)이 있는지 확인해 주세요.
            </p>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                씬 {result.summary.total}개
              </h2>
              <div className="mt-3 flex flex-wrap gap-2" role="tablist">
                {(["전체", "낮", "밤", "불명"] as Filter[]).map((name) => {
                  const count = name === "전체" ? result.summary.total : result.summary[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={filter === name}
                      onClick={() => setFilter(name)}
                      className={`rounded-full border px-4 py-1 text-sm ${
                        filter === name
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {name} {count}
                    </button>
                  );
                })}
              </div>

              {result.warning && (
                <p role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  {result.warning}
                </p>
              )}
              {result.summary.불명 > 0 && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  머리글에 낮/밤이 없거나 낮과 밤이 함께 적혀 있으면 추측하지 않고 &quot;불명&quot;으로
                  표시합니다.
                </p>
              )}
              {result.duplicateNumbers.length > 0 && (
                <p className="mt-2 text-sm text-amber-700">
                  같은 번호가 두 번 이상 나왔습니다: {result.duplicateNumbers.join(", ")}
                </p>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    <tr>
                      <th className="py-2 pr-4">씬</th>
                      <th className="py-2 pr-4">장소</th>
                      <th className="py-2 pr-4">낮/밤</th>
                      <th className="py-2 pr-4">날짜</th>
                      <th className="py-2">근거 (대본 머리글)</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-900 dark:text-zinc-100">
                    {visible.map((scene, i) => (
                      <tr key={`${scene.number}-${scene.line}-${i}`} className="border-b border-zinc-200 dark:border-zinc-800">
                        <td className="py-2 pr-4 font-medium">{scene.number}</td>
                        <td className="py-2 pr-4">{scene.place || "-"}</td>
                        <td className="py-2 pr-4">
                          <span className={scene.time === "불명" ? "text-amber-700" : ""}>{scene.time}</span>
                        </td>
                        <td className="py-2 pr-4">{scene.date ?? "-"}</td>
                        <td className="py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {scene.line}줄: {scene.evidence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <CharacterPanel buildBody={buildBody} disabled={file === null && text.trim().length === 0} />
    </div>
  );
}
