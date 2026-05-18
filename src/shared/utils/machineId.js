import { machineIdSync } from 'node-machine-id';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from '@/lib/dataDir';
import { isServerless } from '@/lib/env';

const MACHINE_ID_FILE = path.join(DATA_DIR, 'machine-id');
let cachedRawId = null;

// Persist raw machine ID to file → guarantees CLI/server/middleware see same value
// even when machineIdSync fails or returns inconsistent values across runtimes.
function loadRawMachineId() {
  if (cachedRawId) return cachedRawId;
  // In serverless containers there's no /etc/machine-id and no `hostname` binary,
  // so node-machine-id's shell fallback prints "hostname: command not found" and
  // returns an empty/garbled string. Skip the shell call entirely and use a
  // deterministic per-deploy ID derived from env so all instances agree.
  if (isServerless()) {
    const seed = process.env.MACHINE_ID_OVERRIDE
      || process.env.VERCEL_DEPLOYMENT_ID
      || process.env.VERCEL_URL
      || process.env.RAILWAY_DEPLOYMENT_ID
      || process.env.RENDER_INSTANCE_ID
      || process.env.HOSTNAME
      || 'serverless-9router';
    cachedRawId = crypto.createHash('sha256').update(seed).digest('hex');
    return cachedRawId;
  }
  try {
    cachedRawId = fs.readFileSync(MACHINE_ID_FILE, 'utf8').trim();
    if (cachedRawId) return cachedRawId;
  } catch {}
  try {
    cachedRawId = machineIdSync();
  } catch {
    cachedRawId = crypto.randomUUID();
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MACHINE_ID_FILE, cachedRawId, { mode: 0o600 });
  } catch {}
  return cachedRawId;
}

export async function getConsistentMachineId(salt = null) {
  const saltValue = salt || process.env.MACHINE_ID_SALT || 'endpoint-proxy-salt';
  const raw = loadRawMachineId();
  return crypto.createHash('sha256').update(raw + saltValue).digest('hex').substring(0, 16);
}

export async function getRawMachineId() {
  return loadRawMachineId();
}

/**
 * Check if we're running in browser or server environment
 * @returns {boolean} True if in browser, false if in server
 */
export function isBrowser() {
  return typeof window !== 'undefined';
}
