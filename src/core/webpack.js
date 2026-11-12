/**
 * Access to the Discord client's webpack runtime.
 *
 * Discord ships its client as webpack chunks registered on a global array.
 * Pushing a chunk with a runtime callback hands us the internal `require`
 * function, whose `.c` property is the cache of every loaded module.
 */

export const CHUNK_GLOBAL = "webpackChunkdiscord_app";

/**
 * @param {Record<string, any>} scope The global object of the Discord client.
 * @returns {{ c: Record<string, { exports: any }> }} webpack's internal require.
 */
export function acquireRequire(scope) {
	const chunks = scope[CHUNK_GLOBAL];
	if (!chunks || typeof chunks.push !== "function") {
		throw new Error(`${CHUNK_GLOBAL} was not found. Run this in the Discord client console.`);
	}

	// The `$` global is cleared before touching the chunk array.
	// Kept for parity with a setup that is known to work.
	try {
		delete scope.$;
	} catch {
		// Non-configurable in some environments. Safe to ignore.
	}

	let captured;
	const returned = chunks.push([
		[Symbol("orbweaver")],
		{},
		(require) => {
			captured = require;
			return require;
		},
	]);
	chunks.pop();

	const require = captured ?? returned;
	if (!require || typeof require.c !== "object") {
		throw new Error("Could not reach the webpack module cache.");
	}
	return require;
}
