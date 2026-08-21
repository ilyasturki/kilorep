import type { Library } from './library.ts';
import type { BatchOutcome, WriteOutcome, WriteRequest } from './write.ts';

/** What every tool needs: the domain view of the records, and the one way to change them. */
export type Tools = {
	library: Library;
	/**
	 * One guarded write, with the memoised view dropped behind it.
	 *
	 * Every tool writes through here rather than calling `writeRecord` itself, so that a
	 * read later in the same request cannot answer from before the write.
	 */
	write: (request: WriteRequest) => WriteOutcome;
	/** The same, for a change that is one fact spread over several records — all or none. */
	writeAll: (requests: WriteRequest[]) => BatchOutcome;
};
