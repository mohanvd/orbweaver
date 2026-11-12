/**
 * Locates modules in the webpack cache by what they can do, not by what they are called.
 *
 * Discord's export names are minified and change between builds (`Z` became `A`,
 * `ZP` became `Ay`, and so on). A lookup that depends on one exact name breaks on
 * the next release. Each lookup here is described by a predicate over the export's
 * shape, with the known names used only as a fast path.
 */

/**
 * @typedef {object} ModuleSpec
 * @property {string} name Human readable name, used in error messages.
 * @property {(candidate: any) => boolean} match Returns true for the export we want.
 * @property {string[]} [hints] Export names this module is known to have used.
 * @property {boolean} [optional] When true, a missing module yields null instead of throwing.
 */

const isCandidate = (value) =>
	value != null && (typeof value === "object" || typeof value === "function");

/**
 * @param {{ c: Record<string, { exports: any }> }} require
 * @param {{ ignore?: any[], warn?: (message: string) => void }} [options]
 */
export function createFinder(require, { ignore = [], warn = () => {} } = {}) {
	const modules = Object.values(require.c);

	/** @param {ModuleSpec} spec */
	const accepts = (spec, value) => {
		if (!isCandidate(value) || ignore.includes(value)) return false;
		try {
			return Boolean(spec.match(value));
		} catch {
			// Exotic exports (proxies, getters with side effects) can throw. Not a match.
			return false;
		}
	};

	const read = (target, key) => {
		try {
			return target?.[key];
		} catch {
			return undefined;
		}
	};

	/**
	 * @param {ModuleSpec} spec
	 * @returns {any | null}
	 */
	return function find(spec) {
		// Fast path: the names this export has been seen under.
		for (const hint of spec.hints ?? []) {
			for (const mod of modules) {
				const value = read(read(mod, "exports"), hint);
				if (accepts(spec, value)) return value;
			}
		}

		// Slow path: every export of every module.
		for (const mod of modules) {
			const exports = read(mod, "exports");
			if (!isCandidate(exports) || ignore.includes(exports)) continue;
			if (accepts(spec, exports)) return exports;

			let keys = [];
			try {
				keys = Object.keys(exports);
			} catch {
				continue;
			}
			for (const key of keys) {
				const value = read(exports, key);
				if (accepts(spec, value)) return value;
			}
		}

		if (spec.optional) {
			warn(`${spec.name} was not found. Continuing without it.`);
			return null;
		}
		throw new Error(
			`${spec.name} was not found. Discord changed its internals and this lookup needs an update.`,
		);
	};
}
