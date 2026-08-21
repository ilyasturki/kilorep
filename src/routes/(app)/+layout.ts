import { redirect } from '@sveltejs/kit';

import { session } from '$lib/api/auth';
import { ApiError, NO_SERVER, deviceToken } from '$lib/api/client';
import { exertionScale } from '$lib/settings/exertion.svelte';
import { restSettings } from '$lib/settings/rest.svelte';
import { historyFrom, lastGripsFrom } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { syncPromptly } from '$lib/sync/client';
import { activeWorkout } from '$lib/workout/active.svelte';
import { restTimer } from '$lib/workout/rest.svelte';

import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;

async function restoreSession(): Promise<void> {
	if (activeWorkout.session !== null) {
		return;
	}

	const store = await getStore();
	const snapshot = await store.loadSnapshot();

	if (snapshot !== null) {
		const workouts = await store.listWorkouts();

		activeWorkout.begin(historyFrom(workouts), snapshot, lastGripsFrom(workouts));

		restTimer.resume(snapshot.rest, snapshot.muted);
	}
}

export const load: LayoutLoad = async ({ url, fetch }) => {
	const store = await getStore();

	await Promise.all([restoreSession(), exertionScale.load(store), restSettings.load(store)]);

	if (import.meta.env.APP_BUILD && deviceToken() === null) {
		return { user: null };
	}

	try {
		const { user } = await session(fetch);

		syncPromptly(user.id);

		return { user };
	} catch (error) {
		if (error instanceof ApiError && error.status === NO_SERVER) {
			return { user: null };
		}

		if (error instanceof ApiError && error.status === 401) {
			if (import.meta.env.APP_BUILD) {
				return { user: null };
			}

			const attempted = `${url.pathname}${url.search}`;
			redirect(307, `/login?redirectTo=${encodeURIComponent(attempted)}`);
		}

		throw error;
	}
};
