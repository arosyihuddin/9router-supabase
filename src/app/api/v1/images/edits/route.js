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
 * POST /v1/images/edits — OpenAI-compatible image editing endpoint.
 *
 * JSON body:
 *   { model, prompt, image: <url | data:URL | base64>, size? }
 *
 * Multipart form-data is not handled here yet — clients should send JSON.
 */
export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  // Convert multipart → JSON shape so downstream stays uniform.
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const prompt = form.get("prompt");
    const model = form.get("model");
    const size = form.get("size");
    const file = form.get("image");

    let image = null;
    if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/png";
      image = `data:${mime};base64,${buf.toString("base64")}`;
    } else if (typeof file === "string") {
      image = file;
    }

    const jsonBody = { model, prompt, image };
    if (size) jsonBody.size = size;

    const newReq = new Request(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization") } : {}),
        ...(request.headers.get("x-connection-id") ? { "x-connection-id": request.headers.get("x-connection-id") } : {}),
      },
      body: JSON.stringify(jsonBody),
    });
    return handleImageGeneration(newReq, { mode: "imageEdit" });
  }

  return handleImageGeneration(request, { mode: "imageEdit" });
}
