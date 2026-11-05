"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccessPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "확인하지 못했습니다. 다시 시도해 주세요.");
    } catch {
      setMessage("서버에 연결하지 못했습니다.");
    } finally {
      setBusy(false);
      setCode("");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-900"
      >
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">씬노트</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          대외비 시나리오를 다루는 서비스입니다. 접근 암호를 입력해 주세요.
        </p>
        <label htmlFor="code" className="mt-6 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          접근 암호
        </label>
        <input
          id="code"
          type="password"
          autoComplete="off"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        {message && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || code.length === 0}
          className="mt-6 w-full rounded-md bg-black px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
