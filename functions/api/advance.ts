// POST /api/advance — ステップ完了・次ステップへの遷移 + Mermaid 図生成

import type { PagesFunction } from "@cloudflare/workers-types";
import type { Env, AdvanceRequest, AdvanceResponse, AdvanceGuardFailed } from "../_lib/types.js";
import { transition } from "../_lib/session.js";
import { buildDiagram } from "../_lib/mermaid.js";

function err(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return err(405, "method_not_allowed", "POST のみ受け付けます");
  }

  // ── 入力検証 ────────────────────────────────────────────────────
  let body: AdvanceRequest;
  try {
    body = (await context.request.json()) as AdvanceRequest;
  } catch {
    return err(400, "invalid_input", "JSON のパースに失敗しました");
  }

  if (!body.session || !body.event) {
    return err(400, "invalid_input", "session / event が必須です");
  }

  const validEvents = ["NEXT", "BACK", "RESET"] as const;
  if (!validEvents.includes(body.event)) {
    return err(400, "invalid_input", `event は NEXT / BACK / RESET のいずれかです`);
  }

  // ── ステートマシン遷移 ───────────────────────────────────────────
  const result = transition(body.session, body.event);

  if (!result.ok) {
    // ガード条件未充足（正常系として 200 を返す）
    return Response.json({
      ok: false,
      error: { code: "guard_failed", message: result.error },
      missing_fields: result.missing_fields,
    } satisfies AdvanceGuardFailed);
  }

  const { session: newSession, diagram_needed } = result;

  // ── NEXT 遷移後に現ステップの Mermaid 図を生成 ────────────────────
  let diagram: string | undefined;
  if (body.event === "NEXT" && diagram_needed) {
    diagram = buildDiagram(diagram_needed, newSession);
    // diagrams を更新（ステップ番号に対応するキー）
    const diagKey = diagram_needed.replace("step", "step").replace("_core", "1")
      .replace("_drilldown", "2").replace("_what_how", "3")
      .replace("_verify", "4").replace("_combine", "5") as keyof typeof newSession.diagrams;
    // シンプルにキーマッピング
    const stepDiagKey: Record<string, keyof typeof newSession.diagrams> = {
      step1_core:      "step1",
      step2_drilldown: "step2",
      step3_what_how:  "step3",
      step4_verify:    "step4",
      step5_combine:   "step5",
    };
    const key = stepDiagKey[diagram_needed];
    if (key) {
      (newSession.diagrams as Record<string, string>)[key] = diagram;
    }

    // complete 遷移時は合体ロボ図も生成
    if (newSession.step === "complete") {
      const finalDiagram = buildDiagram("final", newSession);
      newSession.diagrams.final = finalDiagram;
      newSession.status = "complete";
      diagram = finalDiagram;
    }
  }

  return Response.json({
    ok: true,
    session: newSession,
    ...(diagram !== undefined ? { diagram } : {}),
  } satisfies AdvanceResponse);
};
