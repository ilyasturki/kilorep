import { rmSync } from 'node:fs';

import { RUN_DIR } from './env.ts';

export default function teardown(): void {
	rmSync(RUN_DIR, { recursive: true, force: true });
}
