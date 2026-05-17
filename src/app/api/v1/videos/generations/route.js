import { handleImageGeneration } from "@/sse/handlers/imageGeneration.js";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * POST /v1/videos/generations — OpenAI-style text-to-video endpoint.
 * Body: { model, prompt, size? }
 * Reuses the image generation pipeline with mode="video".
 */
export async function POST(request) {
  return handleImageGeneration(request, { mode: "video" });
}
