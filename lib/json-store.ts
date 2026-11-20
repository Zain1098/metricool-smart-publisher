import fs from 'fs';
import path from 'path';
import os from 'os';

const isServerless = Boolean(
  process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.cwd() && process.cwd().startsWith('/var/task'))
);

export function getStoreFilePath(fileName: string): string {
  return isServerless
    ? path.join(os.tmpdir(), `metricool-${fileName}`)
    : path.join(process.cwd(), 'data', fileName);
}

export function readJsonStore<T>(fileName: string, fallback: T): T {
  const filePath = getStoreFilePath(fileName);
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[json-store] Failed to read ${fileName}, using fallback:`, err);
    return fallback;
  }
}

export function writeJsonStore<T>(fileName: string, data: T): void {
  const filePath = getStoreFilePath(fileName);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[json-store] Failed to write ${fileName}:`, err);
  }
}
