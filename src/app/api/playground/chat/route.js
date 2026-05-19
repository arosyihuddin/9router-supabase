import { NextResponse } from "next/server";
import { getApiKeys } from "@/lib/localDb";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { isServerless } from "@/lib/env";

const CLI_TOKEN_SALT = "9r-cli-auth";

function readAssistantText(data) {
  if (!data || typeof data !== "object") return "";

  const choice = data.choices?.[0];
  const content = choice?.message?.content || choice?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || "")
      .filter(Boolean)
      .join("");
  }

  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((item) => item?.content || [])
      .map((part) => part?.text || "")
      .filter(Boolean)
      .join("");
  }

  return "";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const model = String(body?.model || "").trim();
    const prompt = String(body?.prompt || "").trim();
    const messages = Array.isArray(body?.messages)
      ? body.messages
          .filter((message) => message?.role && typeof message?.content === "string")
          .map((message) => ({ role: message.role, content: message.content }))
      : [];
    const temperature = Number(body?.temperature ?? 0.2);
    const maxTokens = Number(body?.maxTokens ?? 256);

    if (!model) return NextResponse.json({ ok: false, error: "Model is required" }, { status: 400 });
    if (!prompt && messages.length === 0) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    const baseUrl = isServerless()
      ? `https://${request.headers.get("host")}`
      : `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;

    let apiKey = null;
    try {
      const keys = await getApiKeys();
      apiKey = keys.find((key) => key.isActive !== false)?.key || null;
    } catch {}

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (!isServerless()) {
      try {
        headers["x-9r-cli-token"] = await getConsistentMachineId(CLI_TOKEN_SALT);
      } catch {}
    }

    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: Number.isFinite(temperature) ? temperature : 0.2,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 256,
        messages: messages.length > 0 ? messages : [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    const latencyMs = Date.now() - startedAt;
    const raw = await response.text().catch(() => "");
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {}

    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw;
      return NextResponse.json({
        ok: false,
        status: response.status,
        latencyMs,
        error: `HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 800)}` : ""}`,
        raw: data || raw,
      });
    }

    const text = readAssistantText(data);
    return NextResponse.json({
      ok: true,
      status: response.status,
      latencyMs,
      text,
      usage: data?.usage || null,
      raw: data,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
