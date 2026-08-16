import { json } from '@sveltejs/kit';

import { googleClient } from '$lib/server/config';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json({ enabled: googleClient() !== undefined });
