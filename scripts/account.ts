import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

import {
	createUser,
	deleteUser,
	emailProblem,
	findUserByEmail,
	listUsers
} from '../src/lib/server/auth/accounts.ts';
import { passwordProblem } from '../src/lib/server/auth/password.ts';
import { getDatabase } from '../src/lib/server/db/client.ts';
import { databasePath } from '../src/lib/server/db/config.ts';
import { runMigrations } from '../src/lib/server/db/migrate.ts';

/**
 * How a real instance gets its first account.
 *
 * The alternative was a registration endpoint, and it does not survive the
 * bootstrap: a fresh database has no accounts, so the flag would have to be
 * turned on, used, turned off and the server restarted — and during that window
 * anyone who can reach the instance can claim it. This runs on the machine, so
 * the password never crosses a network, never enters the environment where
 * `docker inspect` can read it, and never appears in a log.
 *
 * The password is read from stdin and never from `process.argv`: an argument is
 * visible in `ps` to every user on the box, and it is written to shell history.
 *
 *   bun run account:create lifter@example.com
 *   bun run account:list
 *   bun run account:delete lifter@example.com
 *
 * Piping works too, for automation: `printf '%s' "$PW" | bun run account:create …`
 */

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function usage(): never {
	fail(
		[
			'usage:',
			'  account create <email>          create an account, prompting for a password',
			'  account list                    list accounts',
			'  account delete <email> [--yes]  delete an account and every credential it owns',
			'',
			'  --yes  confirm a delete with no terminal to ask at, for a script or a',
			'         `docker exec` without -t'
		].join('\n')
	);
}

/**
 * Reads a line with the echo suppressed. `readline` writes the typed characters
 * back to its `output` stream, so the way to hide them is to give it one that
 * discards; the prompt is printed directly to stdout instead.
 */
async function promptHidden(question: string): Promise<string> {
	// Implementing `Writable` *is* the callback contract — Node calls `write` and
	// waits for `callback()` — so there is no promise form for the rule to prefer.
	/* oxlint-disable promise/prefer-await-to-callbacks */
	const discard = new Writable({
		write(_chunk, _encoding, callback): void {
			callback();
		}
	});
	/* oxlint-enable promise/prefer-await-to-callbacks */

	process.stdout.write(question);
	const rl = createInterface({ input: process.stdin, output: discard, terminal: true });

	try {
		return await rl.question('');
	} finally {
		rl.close();
		process.stdout.write('\n');
	}
}

async function readPassword(): Promise<string> {
	// Not a terminal: stdin is a pipe or a file, so it *is* the password. One
	// trailing newline is the shell's, not the user's.
	if (!process.stdin.isTTY) {
		return readFileSync(0, 'utf8').replace(/\r?\n$/u, '');
	}

	const password = await promptHidden('password: ');
	const again = await promptHidden('confirm:  ');

	if (password !== again) {
		fail('passwords do not match');
	}

	return password;
}

const db = getDatabase();

// A fresh instance may never have started the server, and creating an account
// in a database with no tables is not a useful error message.
runMigrations(db);

const argv = process.argv.slice(2);
const assumeYes = argv.includes('--yes');
const [command, argument] = argv.filter((value) => value !== '--yes');

if (command === 'create') {
	if (argument === undefined) {
		usage();
	}

	const problem = emailProblem(argument);
	if (problem !== undefined) {
		fail(problem);
	}
	if (findUserByEmail(db, argument) !== undefined) {
		fail(`${argument} already has an account`);
	}

	const password = await readPassword();
	const passwordIssue = passwordProblem(password);
	if (passwordIssue !== undefined) {
		fail(passwordIssue);
	}

	const user = await createUser(db, argument, password);
	console.log(`created ${user.email} (${user.id}) in ${databasePath}`);
	console.log('sign in from the app, or mint a token from Settings once signed in.');
} else if (command === 'list') {
	const users = listUsers(db);

	if (users.length === 0) {
		console.log(`no accounts in ${databasePath}`);
	} else {
		for (const user of users) {
			console.log(`${user.email}  ${user.id}  created ${user.createdAt.toISOString()}`);
		}
	}
} else if (command === 'delete') {
	if (argument === undefined) {
		usage();
	}

	const user = findUserByEmail(db, argument);
	if (user === undefined) {
		fail(`no account for ${argument}`);
	}

	// Deleting cascades to every credential and the sync counter, and there is no
	// undo. Retyping the address is cheap next to that.
	//
	// No terminal — a `docker exec` without `-t`, a CI step, a shell script, all
	// ordinary ways to run this — means there is nobody to ask, and skipping the
	// question there turned an irreversible cascade into one unconfirmed command.
	// `--yes` is how a caller with no terminal says it meant it.
	if (process.stdin.isTTY) {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const confirmation = await rl.question(`retype ${user.email} to confirm deletion: `);
		rl.close();

		if (confirmation.trim().toLowerCase() !== user.email) {
			fail('not confirmed, nothing deleted');
		}
	} else if (!assumeYes) {
		fail(`refusing to delete ${user.email} with no terminal to confirm at; pass --yes to mean it`);
	}

	deleteUser(db, user.email);
	console.log(`deleted ${user.email} and every credential it owned`);
} else {
	usage();
}
