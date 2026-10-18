import { spawn, spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { APP_DIR, APP_PORT, APP_URL, DATABASE_PATH, WEB_PORT, WEB_URL } from './env.ts';

function build(script: string): void {
	const { status, stdout, stderr } = spawnSync('bun', ['run', script], { encoding: 'utf8' });

	if (status !== 0) {
		process.stderr.write(stdout + stderr);
		process.exit(status ?? 1);
	}
}

build('build:server');

Object.assign(process.env, { DEFAULT_SERVER: WEB_URL, APP_OUT: APP_DIR });
build('build:app');

Object.assign(process.env, {
	HOST: 'localhost',
	PORT: String(WEB_PORT),
	DATABASE_PATH,
	CORS_ORIGINS: APP_URL
});

const web = spawn('node', ['build/server/index.js'], { stdio: 'inherit' });

web.on('exit', (code) => {
	process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		web.kill(signal);
		process.exit(0);
	});
}

const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};

const root = path.resolve(APP_DIR);

async function isFile(file: string): Promise<boolean> {
	try {
		const entry = await stat(file);

		return entry.isFile();
	} catch {
		return false;
	}
}

// The app bundle as the WebView sees it: a static tree whose unknown paths fall back to index.html.
async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const { pathname } = new URL(request.url ?? '/', APP_URL);
	const wanted = path.join(root, path.normalize(decodeURIComponent(pathname)));
	const file =
		wanted.startsWith(root) && (await isFile(wanted)) ? wanted : path.join(root, 'index.html');

	response.writeHead(200, {
		'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'
	});
	createReadStream(file).pipe(response);
}

createServer((request, response) => {
	void respond(request, response);
}).listen(APP_PORT, 'localhost');
