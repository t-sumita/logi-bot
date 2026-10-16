// POST /api/diagram — 指定ステップの Mermaid 図を（再）生成する

import type { PagesFunction } from "@cloudflare/workers-types";
import type { Env, DiagramRequest, DiagramResponse, StepName } from "../_lib/types.js";
import { buildDiagram } from "../_lib/mermaid.js";

function err(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

const VALID_STEPS: (StepName | "final")[] = [
  "step1_core", "step2_drilldown", "step3_what_how",
  "step4_verify", "step5_combine", "final",
];

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return err(405, "method_not_allowed", "POST のみ受け付けます");
  }

  // ── 入力検証 ────────────────────────────────────────────────────
  let body: DiagramRequest;
  try {
    body = (await context.request.json()) as DiagramRequest;
  } catch {
    return err(400, "invalid_input", "JSON のパースに失敗しました");
  }

  if (!body.session || !body.step) {
    return err(400, "invalid_input", "session / step が必須です");
  }

  if (!VALID_STEPS.includes(body.step as StepName | "final")) {
    return err(400, "invalid_input", `step は ${VALID_STEPS.join(" / ")} のいずれかです`);
  }

  // ── Mermaid 図生成 ───────────────────────────────────────────────
  const diagram = buildDiagram(body.step, body.session);

  return Response.json({
    ok: true,
    diagram,
    step: body.step,
  } satisfies DiagramResponse);
};
