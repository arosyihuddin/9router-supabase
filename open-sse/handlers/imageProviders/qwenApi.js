// Qwen API (qwen.aikit.club) — OpenAI-compatible text-to-image / image edit / text-to-video.
// Single adapter handles all three; the route URL is selected via `mode` from the caller.
//
// Endpoints:
//   POST /v1/images/generations  { prompt, size }      → { data:[{ url }] }
//   POST /v1/images/edits        multipart or JSON     → { data:[{ url }] }
//   POST /v1/videos/generations  { prompt, size }      → { data:[{ url }] }

import { nowSec } from "./_base.js";

const BASE_URL = "https://qwen.aikit.club/v1";

const ENDPOINT = {
  image: `${BASE_URL}/images/generations`,
  imageEdit: `${BASE_URL}/images/edits`,
  video: `${BASE_URL}/videos/generations`,
};

function pickMode(body) {
  // Caller may set body.__mode = "image" | "imageEdit" | "video".
  // Fallback: if body has image/images → imageEdit, else image.
  if (body?.__mode && ENDPOINT[body.__mode]) return body.__mode;
  if (body?.image || (Array.isArray(body?.images) && body.images.length)) return "imageEdit";
  return "image";
}

async function toJsonImage(input) {
  // Accept: data URL, http(s) URL, or raw base64.
  if (typeof input !== "string") throw new Error("image must be a string (URL, data URL, or base64)");
  if (input.startsWith("data:") || input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  // Treat as raw base64 PNG
  return `data:image/png;base64,${input}`;
}

export default {
  buildUrl: (_model, _credentials, opts = {}) => {
    const mode = opts.mode || "image";
    return ENDPOINT[mode] || ENDPOINT.image;
  },

  buildHeaders: (creds) => {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const key = creds?.apiKey || creds?.accessToken;
    if (key) headers["Authorization"] = `Bearer ${key}`;
    return headers;
  },

  buildBody: async (model, body) => {
    const mode = pickMode(body);
    const prompt = body.prompt;
    if (!prompt) throw new Error("Missing required field: prompt");

    if (mode === "imageEdit") {
      const image = body.image || body.images?.[0];
      if (!image) throw new Error("Image edit requires `image` (URL, data URL, or base64)");
      const out = { prompt, image: await toJsonImage(image) };
      if (model) out.model = model;
      return out;
    }

    // image / video
    const out = { prompt };
    if (model) out.model = model;
    if (body.size) out.size = body.size;
    return out;
  },

  // Already OpenAI-compatible. Add `created` if upstream omits it.
  normalize: (responseBody, prompt) => {
    if (responseBody?.data && Array.isArray(responseBody.data)) {
      return {
        created: responseBody.created || nowSec(),
        data: responseBody.data.map((item) =>
          item?.revised_prompt ? item : { ...item, revised_prompt: item?.revised_prompt || prompt }
        ),
      };
    }
    return responseBody;
  },
};
