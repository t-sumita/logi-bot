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
    step: "step1_core",
    status: "in_progress",
    fast_track: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: {
        intro:   { audience: "", hook: "" },
        closing: { cta: "" },
        title:   "",
      },
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

await check("step1_core での通常メッセージ → 200 ok:true", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "毎日大量のメールが届き、重要な連絡を見落としています",
    step: "step1_core",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(typeof body.reply === "string" && body.reply.length > 0, "reply が空");
  assert(body.session, "session が返らない");
});

await check("バルクインプット（step1_core + reality 空 + 100文字超）→ fast_track:true", async () => {
  const longText = "現在の課題：社内の情報共有が非効率で、週5時間が無駄な調整会議に費やされています。" +
    "理想：リアルタイム共有で意思決定を3日から1日以内に短縮。" +
    "提案：SlackとNotionを統合したワークフロー導入。IT部門2名で1ヶ月の初期設定後、全社展開。";
  const { status, body } = await post("/api/chat", {
    session: baseSession({ step: "step1_core" }),
    message: longText,
    step: "step1_core",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(body.fast_track === true, `fast_track=${body.fast_track}`);
  assert(typeof body.first_incomplete_step === "string", "first_incomplete_step がない");
  assert(body.session.fast_track === true, "session.fast_track が true でない");
});

await check("reality 入力済みの step1_core ではバルク扱いにならない", async () => {
  const longText = "VIP顧客への即時対応、商談メールの自動タスク化、誤判定防止ホワイトリスト管理など守りの施策も必要です。これは100文字を超える長いテキストです。";
  const session = baseSession({ step: "step1_core" });
  session.parts.core.reality = "既存の現実";
  const { status, body } = await post("/api/chat", {
    session,
    message: longText,
    step: "step1_core",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true);
  assert(body.fast_track !== true, "既存reality有りでバルクになってはいけない");
});

await check("message が空 → 400", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "",
    step: "step1_core",
  });
  assert(status === 400, `status=${status}`);
  assert(body.ok === false);
});

await check("session なし → 400", async () => {
  const { status } = await post("/api/chat", { message: "hello", step: "step1_core" });
  assert(status === 400);
});

await check("GET → 405", async () => {
  const res = await fetch(`${BASE}/api/chat`);
  assert(res.status === 405, `status=${res.status}`);
});

// ── /api/advance ──────────────────────────────────────────────────

console.log("\n📡 /api/advance");

await check("NEXT: step1_core でガード失敗（core 空）→ ok:false guard_failed", async () => {
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
  session.parts.core.reality  = "毎日120通受信・月3件見落とし";
  session.parts.core.ideal    = "見落としゼロ・確認5分以内";
  session.parts.core.proposal = "AI自動選別＋朝の要約通知";
  const { status, body } = await post("/api/advance", { session, event: "NEXT" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step2_drilldown", `step=${body.session.step}`);
  assert(typeof body.diagram === "string" && body.diagram.startsWith("flowchart"));
  assert(body.session.diagrams.step1, "diagrams.step1 が保存されていない");
});

await check("NEXT: step2 フィールド揃い → step3_what_how", async () => {
  const session = baseSession({ step: "step2_drilldown" });
  session.parts.core.reality  = "現実";
  session.parts.core.ideal    = "理想";
  session.parts.core.proposal = "提案";
  session.parts.drilldown.reality_factors = ["要因1"];
  session.parts.drilldown.ideal_goals     = ["目標1"];
  const { status, body } = await post("/api/advance", { session, event: "NEXT" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step3_what_how", `step=${body.session.step}`);
});

await check("BACK: step2_drilldown → step1_core", async () => {
  const session = baseSession({ step: "step2_drilldown" });
  const { status, body } = await post("/api/advance", { session, event: "BACK" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step1_core");
});

await check("BACK: step1_core → 戻れない（ok:false）", async () => {
  const session = baseSession({ step: "step1_core" });
  const { status, body } = await post("/api/advance", { session, event: "BACK" });
  assert(status === 200);
  assert(body.ok === false, "step1_core から戻れてはいけない");
});

await check("RESET → step1_core", async () => {
  const session = baseSession({ step: "step3_what_how" });
  const { status, body } = await post("/api/advance", { session, event: "RESET" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step1_core", `step=${body.session.step}`);
});

await check("event なし → 400", async () => {
  const { status } = await post("/api/advance", { session: baseSession() });
  assert(status === 400);
});

// ── /api/diagram ──────────────────────────────────────────────────

console.log("\n📡 /api/diagram");

await check("step1_core の図生成 → flowchart TB", async () => {
  const session = baseSession({ step: "step1_core" });
  session.parts.core.reality  = "毎日120通受信・月3件見落とし";
  session.parts.core.ideal    = "見落としゼロ・確認5分以内";
  session.parts.core.proposal = "AI自動選別＋朝の要約通知";
  const { status, body } = await post("/api/diagram", { session, step: "step1_core" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.diagram.includes("flowchart TB"), `diagram=${body.diagram.slice(0, 50)}`);
  assert(body.step === "step1_core");
});

await check("step2_drilldown の図生成 → flowchart LR", async () => {
  const session = baseSession({ step: "step2_drilldown" });
  session.parts.drilldown.reality_factors = ["1日120通受信", "判定基準が曖昧"];
  session.parts.drilldown.ideal_goals     = ["見落としゼロ", "確認5分以内"];
  const { status, body } = await post("/api/diagram", { session, step: "step2_drilldown" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.diagram.includes("flowchart LR"));
});

await check("final 図生成 → flowchart TB + 合体ロボ要素", async () => {
  const session = baseSession();
  session.parts.core.reality   = "メール過多";
  session.parts.core.ideal     = "確認5分以内";
  session.parts.core.proposal  = "AI選別";
  session.parts.frame.intro.hook    = "メール処理に追われていませんか？";
  session.parts.frame.closing.cta   = "今週から試験導入しましょう";
  const { status, body } = await post("/api/diagram", { session, step: "final" });
  assert(status === 200);
  assert(body.diagram.includes("flowchart TB"));
  assert(body.diagram.includes("胴体"));
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
