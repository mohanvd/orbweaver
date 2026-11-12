const TAG = "[orbweaver]";
const TAG_STYLE = "color:#8b5cf6;font-weight:bold";

/**
 * @param {Pick<Console, "log" | "warn" | "error">} sink
 */
export function createLogger(sink = console) {
	const write = (method) => (...args) => sink[method](`%c${TAG}`, TAG_STYLE, ...args);
	return {
		info: write("log"),
		warn: write("warn"),
		error: write("error"),
	};
}

/** @typedef {ReturnType<typeof createLogger>} Logger */
