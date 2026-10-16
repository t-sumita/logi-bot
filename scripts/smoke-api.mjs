/**
 * smoke-api.mjs — API 疎通テスト（MOCK モード）
 * 前提: npm run dev:mock でサーバーが起動していること
 * 実行: node scripts/smoke-api.mjs
 */

const BASE = "http://localhost:8788";

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${label}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? "アサーション失敗");
}

/** テスト用の最小セッションを生成 */
function baseSession(overrides = {}) {
  return {
    sessionId: "smoke-test",
    title: "スモークテスト",
    step: "onboarding",
    status: "in_progress",
    fast_track: false,
    onboarding_complete: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
    diagrams: {},
    history: [],
    ...overrides,
  };
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── /api/chat ─────────────────────────────────────────────────────

console.log("\n📡 /api/chat");

await check("通常の onboarding メッセージ → 200 ok:true", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "新製品開発の計画",
    step: "onboarding",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(typeof body.reply === "string" && body.reply.length > 0, "reply が空");
  assert(body.session, "session が返らない");
});

await check("バルクインプット（100文字超）→ fast_track:true", async () => {
  const longText = "現在の問題点は、社内の情報共有ツールが古く、部門間の連携が非効率なため" +
    "プロジェクトの進捗が遅れがちです。理想的には、リアルタイムで情報が共有され、" +
    "意思決定が迅速に行われる状態を目指しています。提案としては、Slack と Notion を" +
    "統合した新しいワークフローを導入することで解決できると考えています。";
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: longText,
    step: "onboarding",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(body.fast_track === true, `fast_track=${body.fast_track}`);
  assert(typeof body.first_incomplete_step === "string", "first_incomplete_step がない");
  assert(body.session.fast_track === true, "session.fast_track が true でない");
});

await check("step1_core での通常メッセージ", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession({ step: "step1_core" }),
    message: "現状の業務フローが非効率で時間がかかっています",
    step: "step1_core",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true);
  assert(body.session.step === "step1_core", "stepが変わってしまった");
});

await check("message が空 → 400", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "",
    step: "onboarding",
  });
  assert(status === 400, `status=${status}`);
  assert(body.ok === false);
});

await check("session なし → 400", async () => {
  const { status } = await post("/api/chat", { message: "hello", step: "onboarding" });
  assert(status === 400);
});

await check("GET → 405", async () => {
  const res = await fetch(`${BASE}/api/chat`);
  assert(res.status === 405, `status=${res.status}`);
});

// ── /api/advance ──────────────────────────────────────────────────

console.log("\n📡 /api/advance");

await check("NEXT: onboarding → step1_core（短い入力後）", async () => {
  const { status, body } = await post("/api/advance", {
    session: baseSession({ step: "onboarding", onboarding_complete: false }),
    event: "NEXT",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true);
  assert(body.session.step === "step1_core", `step=${body.session.step}`);
});

await check("NEXT: step1_core でガード失敗 → ok:false guard_failed", async () => {
  const { status, body } = await post("/api/advance", {
    session: baseSession({ step: "step1_core" }),
    event: "NEXT",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === false);
  assert(body.error.code === "guard_failed");
  assert(Array.isArray(body.missing_fields) && body.missing_fields.length > 0);
});

await check("NEXT: step1 フィールド揃い → step2_drilldown + diagram 返却", async () => {
  const session = baseSession({ step: "step1_core" });
  session.parts.core = { reality: "現実の課題", ideal: "理想の状態", proposal: "解決策の提案" };
  const { status, body } = await post("/api/advance", { session, event: "NEXT" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step2_drilldown");
  assert(typeof body.diagram === "string" && body.diagram.startsWith("flowchart"));
  assert(body.session.diagrams.step1, "diagrams.step1 が保存されていない");
});

await check("BACK: step2_drilldown → step1_core", async () => {
  const session = baseSession({ step: "step2_drilldown" });
  const { status, body } = await post("/api/advance", { session, event: "BACK" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step1_core");
});

await check("RESET → idle", async () => {
  const session = baseSession({ step: "step3_what_how" });
  const { status, body } = await post("/api/advance", { session, event: "RESET" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "idle");
});

await check("event なし → 400", async () => {
  const { status } = await post("/api/advance", { session: baseSession() });
  assert(status === 400);
});

// ── /api/diagram ──────────────────────────────────────────────────

console.log("\n📡 /api/diagram");

await check("step1_core の図生成 → flowchart TB", async () => {
  const session = baseSession({ step: "step1_core" });
  session.parts.core = { reality: "現実", ideal: "理想", proposal: "提案" };
  const { status, body } = await post("/api/diagram", { session, step: "step1_core" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.diagram.includes("flowchart TB"));
  assert(body.step === "step1_core");
});

await check("final 図生成 → flowchart TB + subgraph", async () => {
  const session = baseSession();
  session.parts.core   = { reality: "R", ideal: "I", proposal: "P" };
  session.parts.frame  = { intro: { audience: "a", hook: "hook" }, closing: { cta: "cta" }, title: "" };
  const { status, body } = await post("/api/diagram", { session, step: "final" });
  assert(status === 200);
  assert(body.diagram.includes("subgraph"));
});

await check("不正な step → 400", async () => {
  const { status } = await post("/api/diagram", { session: baseSession(), step: "invalid_step" });
  assert(status === 400);
});

await check("step なし → 400", async () => {
  const { status } = await post("/api/diagram", { session: baseSession() });
  assert(status === 400);
});

// ── 結果サマリ ────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`結果: ${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
