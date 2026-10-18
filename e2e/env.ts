import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const WEB_PORT = Number(process.env.E2E_PORT ?? '4400');

export const APP_PORT = WEB_PORT + 1;

export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const APP_URL = `http://localhost:${APP_PORT}`;

export const APP_DIR = 'build/e2e-app';

// Made once by the runner; its workers and the server inherit it, so a run shares one database.
process.env.E2E_RUN_DIR ??= mkdtempSync(path.join(tmpdir(), 'kilorep-e2e-'));

export const RUN_DIR = process.env.E2E_RUN_DIR;

export const DATABASE_PATH = path.join(RUN_DIR, 'kilorep.db');
