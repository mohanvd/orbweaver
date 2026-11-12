/**
 * The Discord internals this tool depends on, each described by its shape.
 */

const fn = (value) => typeof value === "function";
const proto = (value) => Object.getPrototypeOf(value) ?? {};

/** @type {Record<string, import("../core/finder.js").ModuleSpec>} */
export const MODULE_SPECS = {
	streamingStore: {
		name: "ApplicationStreamingStore",
		hints: ["A", "Z"],
		match: (x) => fn(proto(x).getStreamerActiveStreamMetadata),
	},
	runningGameStore: {
		name: "RunningGameStore",
		hints: ["Ay", "ZP"],
		match: (x) => fn(x.getRunningGames) && fn(x.getGameForPID),
	},
	questsStore: {
		name: "QuestsStore",
		hints: ["A", "Z"],
		match: (x) => fn(proto(x).getQuest) && x.quests != null,
	},
	channelStore: {
		name: "ChannelStore",
		hints: ["A", "Z"],
		match: (x) => fn(proto(x).getAllThreadsForParent),
	},
	// Only used to find a voice channel for activity quests when there are no DMs.
	guildChannelStore: {
		name: "GuildChannelStore",
		hints: ["Ay", "ZP"],
		optional: true,
		match: (x) =>
			fn(x.getAllGuilds) &&
			(fn(x.getSFWDefaultChannel) ||
				fn(x.getDefaultChannel) ||
				fn(x.getVocalChannelIds) ||
				fn(x.getSelectableChannelIds)),
	},
	dispatcher: {
		name: "FluxDispatcher",
		hints: ["h", "Z"],
		match: (x) => fn(proto(x).flushWaitQueue),
	},
	// Discord's HTTP helper is a plain object whose verbs take `{ url, body }`.
	// The request library underneath it (superagent) exposes the same verbs but
	// takes a URL string, so it has to be told apart by the extras it carries.
	api: {
		name: "HTTP client",
		hints: ["Bo", "tn"],
		match: (x) =>
			typeof x === "object" &&
			fn(x.get) &&
			fn(x.post) &&
			fn(x.put) &&
			fn(x.patch) &&
			fn(x.del) &&
			!fn(x.head) &&
			!fn(x.agent) &&
			x.Request == null,
	},
};

/**
 * @param {(spec: import("../core/finder.js").ModuleSpec) => any} find
 * @returns {Record<keyof typeof MODULE_SPECS, any>}
 */
export function resolveModules(find) {
	const resolved = {};
	for (const [key, spec] of Object.entries(MODULE_SPECS)) {
		resolved[key] = find(spec);
	}
	return resolved;
}
