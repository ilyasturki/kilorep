export type Notification = {
	title: string;
	// Never a raw email: it lands on ntfy.sh.
	message: string;
	priority?: 1 | 2 | 3 | 4 | 5;
	tags?: string[];
};

// The ntfy-relay contract (infra-apps): one stdout line, `NOTIFY ` then compact JSON.
export function notify(notification: Notification): void {
	process.stdout.write(`NOTIFY ${JSON.stringify(notification)}\n`);
}
