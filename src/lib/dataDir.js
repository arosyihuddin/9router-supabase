import fs from "node:fs";
import path from "path";
import os from "os";
import { isServerless } from "./env.js";

const APP_NAME = "9router";

function defaultDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}

export function getDataDir() {
  // Use /tmp for serverless environments (no directory creation)
  if (isServerless()) {
    return "/tmp/9router";
  }

  const configured = process.env.DATA_DIR;
  if (!configured) {
    const dir = defaultDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      if (e?.code !== "EEXIST") {
        console.warn(`[DATA_DIR] Could not create '${dir}': ${e.message}`);
      }
    }
    return dir;
  }

  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

export const DATA_DIR = getDataDir();
