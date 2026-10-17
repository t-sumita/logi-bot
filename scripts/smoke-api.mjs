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
    step: "step1_head",
    status: "in_progress",
    fast_track: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parts: {
      head:      { concept: "", message: "" },
      body:      { core_system: "" },
      right_arm: { items: [] },
      left_arm:  { items: [] },
      legs:      { foundation: "", next_action: "" },
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

await check("step1_head での通常メッセージ → 200 ok:true", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "AIでメール管理を効率化するシステムを作りたい",
    step: "step1_head",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(typeof body.reply === "string" && body.reply.length > 0, "reply が空");
  assert(body.session, "session が返らない");
});

await check("バルクインプット（step1_head + concept 空 + 100文字超）→ fast_track:true", async () => {
  const longText = "AIを使ったメール管理システムを構築したい。重要なメールだけを選別して確認時間を減らす。" +
    "VIP顧客への即時対応、商談メールの自動タスク化、誤判定防止のホワイトリスト管理、" +
    "Gmail APIとCloudflare Workersで実装、月額500円以内で運用できるようにする。";
  const { status, body } = await post("/api/chat", {
    session: baseSession({ step: "step1_head" }),
    message: longText,
    step: "step1_head",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true, `ok=${body.ok}`);
  assert(body.fast_track === true, `fast_track=${body.fast_track}`);
  assert(typeof body.first_incomplete_step === "string", "first_incomplete_step がない");
  assert(body.session.fast_track === true, "session.fast_track が true でない");
});

await check("concept 入力済みの step1_head ではバルク扱いにならない", async () => {
  const longText = "VIP顧客への即時対応、商談メールの自動タスク化、誤判定防止ホワイトリスト管理など守りの施策も必要です。これは100文字を超える長いテキストです。";
  const session = baseSession({ step: "step1_head" });
  session.parts.head.concept = "既存のコンセプト";
  const { status, body } = await post("/api/chat", {
    session,
    message: longText,
    step: "step1_head",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === true);
  assert(body.fast_track !== true, "既存concept有りでバルクになってはいけない");
});

await check("message が空 → 400", async () => {
  const { status, body } = await post("/api/chat", {
    session: baseSession(),
    message: "",
    step: "step1_head",
  });
  assert(status === 400, `status=${status}`);
  assert(body.ok === false);
});

await check("session なし → 400", async () => {
  const { status } = await post("/api/chat", { message: "hello", step: "step1_head" });
  assert(status === 400);
});

await check("GET → 405", async () => {
  const res = await fetch(`${BASE}/api/chat`);
  assert(res.status === 405, `status=${res.status}`);
});

// ── /api/advance ──────────────────────────────────────────────────

console.log("\n📡 /api/advance");

await check("NEXT: step1_head でガード失敗（concept 空）→ ok:false guard_failed", async () => {
  const { status, body } = await post("/api/advance", {
    session: baseSession({ step: "step1_head" }),
    event: "NEXT",
  });
  assert(status === 200, `status=${status}`);
  assert(body.ok === false);
  assert(body.error.code === "guard_failed");
  assert(Array.isArray(body.missing_fields) && body.missing_fields.length > 0);
});

await check("NEXT: step1 フィールド揃い → step2_body + diagram 返却", async () => {
  const session = baseSession({ step: "step1_head" });
  session.parts.head.concept = "AIでメール管理を自動化する";
  const { status, body } = await post("/api/advance", { session, event: "NEXT" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step2_body", `step=${body.session.step}`);
  assert(typeof body.diagram === "string" && body.diagram.startsWith("flowchart"));
  assert(body.session.diagrams.step1, "diagrams.step1 が保存されていない");
});

await check("NEXT: step2 フィールド揃い → step3_right_arm", async () => {
  const session = baseSession({ step: "step2_body" });
  session.parts.head.concept = "コンセプト";
  session.parts.body.core_system = "自動スコアリングエンジン";
  const { status, body } = await post("/api/advance", { session, event: "NEXT" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step3_right_arm", `step=${body.session.step}`);
});

await check("BACK: step2_body → step1_head", async () => {
  const session = baseSession({ step: "step2_body" });
  const { status, body } = await post("/api/advance", { session, event: "BACK" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step1_head");
});

await check("BACK: step1_head → 戻れない（ok:false）", async () => {
  const session = baseSession({ step: "step1_head" });
  const { status, body } = await post("/api/advance", { session, event: "BACK" });
  assert(status === 200);
  assert(body.ok === false, "step1_head から戻れてはいけない");
});

await check("RESET → step1_head", async () => {
  const session = baseSession({ step: "step3_right_arm" });
  const { status, body } = await post("/api/advance", { session, event: "RESET" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.session.step === "step1_head", `step=${body.session.step}`);
});

await check("event なし → 400", async () => {
  const { status } = await post("/api/advance", { session: baseSession() });
  assert(status === 400);
});

// ── /api/diagram ──────────────────────────────────────────────────

console.log("\n📡 /api/diagram");

await check("step1_head の図生成 → flowchart TB", async () => {
  const session = baseSession({ step: "step1_head" });
  session.parts.head.concept = "AIでメール自動化";
  session.parts.head.message = "確認時間を1日5分に";
  const { status, body } = await post("/api/diagram", { session, step: "step1_head" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.diagram.includes("flowchart TB"), `diagram=${body.diagram.slice(0, 50)}`);
  assert(body.step === "step1_head");
});

await check("step3_right_arm の図生成 → flowchart TD", async () => {
  const session = baseSession({ step: "step3_right_arm" });
  session.parts.right_arm.items = ["VIP顧客即時対応", "商談メール自動タスク化"];
  const { status, body } = await post("/api/diagram", { session, step: "step3_right_arm" });
  assert(status === 200);
  assert(body.ok === true);
  assert(body.diagram.includes("flowchart TD"));
});

await check("final 図生成 → flowchart TD + 合体ロボ要素", async () => {
  const session = baseSession();
  session.parts.head.concept    = "AIメール管理";
  session.parts.body.core_system = "自動スコアリング";
  session.parts.right_arm.items  = ["VIP対応"];
  session.parts.left_arm.items   = ["ホワイトリスト"];
  session.parts.legs.foundation  = "Gmail + Cloudflare";
  const { status, body } = await post("/api/diagram", { session, step: "final" });
  assert(status === 200);
  assert(body.diagram.includes("flowchart TD"));
  assert(body.diagram.includes("頭"));
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
