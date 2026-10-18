import { redirect } from '@sveltejs/kit';

import { session } from '$lib/api/auth';
import { ApiError, NO_SERVER, deviceToken } from '$lib/api/client';
import { exerciseCatalog } from '$lib/exercises/catalog.svelte';
import { exertionScale } from '$lib/settings/exertion.svelte';
import { restSettings } from '$lib/settings/rest.svelte';
import { historyFrom, lastGripsFrom } from '$lib/store/derive';
import type { Store } from '$lib/store/store';
import { getStore } from '$lib/store/store';
import { syncPromptly } from '$lib/sync/client';
import { activeWorkout } from '$lib/workout/active.svelte';
import { restTimer } from '$lib/workout/rest.svelte';

import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;

// The catalog first: a session's hints and grips settle against the customs it may name.
async function restoreSession(store: Store): Promise<void> {
	const { byId } = await exerciseCatalog.load(store);

	if (activeWorkout.session !== null) {
		return;
	}

	const snapshot = await store.loadSnapshot();

	if (snapshot !== null) {
		const workouts = await store.listWorkouts();

		activeWorkout.begin(historyFrom(workouts, byId), snapshot, lastGripsFrom(workouts));

		restTimer.resume(snapshot.rest, snapshot.muted, snapshot.dismissed);
	}
}

export const load: LayoutLoad = async ({ url, fetch }) => {
	const store = await getStore();

	await Promise.all([restoreSession(store), exertionScale.load(store), restSettings.load(store)]);

	if (import.meta.env.APP_BUILD && deviceToken() === null) {
		return { user: null, stranded: false };
	}

	try {
		const { user } = await session(fetch);

		// A store somebody else claimed syncs nothing: `claimOwner` refuses it and the
		// exchange stalls on `other-account` for as long as the session lasts. On the phone
		// `ServerSection` puts that to a person at the moment they sign in; the web has no
		// Server section, and `/login` cannot stand in for it — Google returns through a
		// server redirect that never touches the page. So the web asks here, on the one
		// path both of its sign-ins come back through.
		//
		// An unclaimed store is not stranded: `claimOwner` takes it, which is what a first
		// sign-in in a fresh browser is supposed to do.
		const owner = await store.owner();
		const stranded = !import.meta.env.APP_BUILD && owner !== null && owner !== user.id;

		if (stranded) {
			return { user, stranded };
		}

		syncPromptly(user.id);

		return { user, stranded };
	} catch (error) {
		if (error instanceof ApiError && error.status === NO_SERVER) {
			return { user: null, stranded: false };
		}

		if (error instanceof ApiError && error.status === 401) {
			if (import.meta.env.APP_BUILD) {
				return { user: null, stranded: false };
			}

			const attempted = `${url.pathname}${url.search}`;
			redirect(307, `/login?redirectTo=${encodeURIComponent(attempted)}`);
		}

		throw error;
	}
};
