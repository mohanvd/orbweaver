/**
 * Temporarily replaces a method on an object and returns a function that undoes it.
 *
 * Store methods usually live on the prototype. Restoring by assignment would leave
 * a shadowing own property behind, so the original layout is put back exactly:
 * an own property is reassigned, an inherited one is uncovered by deleting ours.
 *
 * @param {Record<string, any>} target
 * @param {string} key
 * @param {Function} replacement
 * @returns {() => void} restore
 */
export function patch(target, key, replacement) {
	const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
	const original = target[key];
	target[key] = replacement;

	let restored = false;
	return function restore() {
		if (restored) return;
		restored = true;
		if (hadOwn) target[key] = original;
		else delete target[key];
	};
}
