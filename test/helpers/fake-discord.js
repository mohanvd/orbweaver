/**
 * A small stand-in for the parts of the Discord client that orbweaver touches.
 * Export names are randomised on purpose: nothing in the tool may depend on them.
 */

const DAY = 24 * 60 * 60 * 1000;

export function makeQuest({
	id = "1",
	name = `Quest ${id}`,
	type = "WATCH_VIDEO",
	target = 30,
	done = 0,
	enrolled = true,
	completed = false,
	expiresIn = DAY,
	applicationId = "4242",
	configVersion = 2,
} = {}) {
	return {
		id,
		userStatus: {
			enrolledAt: enrolled ? new Date(Date.now() - DAY).toISOString() : null,
			completedAt: completed ? new Date().toISOString() : null,
			progress: { [type]: { value: done } },
		},
		config: {
			configVersion,
			expiresAt: new Date(Date.now() + expiresIn).toISOString(),
			messages: { questName: name },
			taskConfigV2: { tasks: { [type]: { target, applications: [{ id: applicationId }] } } },
		},
	};
}

/** The raw request library: same verbs as Discord's helper, different calling convention. */
function makeSuperagentDecoy(calls) {
	function request() {}
	for (const verb of ["get", "post", "put", "patch", "del", "head"]) {
		request[verb] = (url) => {
			calls.push({ client: "superagent", verb, url });
			return Promise.resolve({ body: {} });
		};
	}
	request.agent = () => request;
	request.Request = class {};
	return request;
}

export function createFakeDiscord({
	quests = [],
	desktop = true,
	httpKey = "qX",
	withGuildChannels = false,
	privateChannels = [{ id: "dm-1" }],
	onPost = () => ({ body: {} }),
	onGet = () => ({ body: [{ name: "Some Game", executables: [{ os: "win32", name: "game.exe" }] }] }),
} = {}) {
	const calls = [];
	const events = [];
	const listeners = new Map();

	class StreamingStore {
		getStreamerActiveStreamMetadata() {
			return null;
		}
	}
	class RunningGameStore {
		getRunningGames() {
			return [{ name: "Real Game", pid: 1 }];
		}
		getGameForPID() {
			return undefined;
		}
	}
	class QuestsStore {
		getQuest(id) {
			return this.quests.get(id);
		}
		get quests() {
			return new Map(quests.map((quest) => [quest.id, quest]));
		}
	}
	class ChannelStore {
		getAllThreadsForParent() {
			return [];
		}
		getSortedPrivateChannels() {
			return privateChannels;
		}
	}
	class Dispatcher {
		flushWaitQueue() {}
		subscribe(type, listener) {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type).add(listener);
		}
		unsubscribe(type, listener) {
			listeners.get(type)?.delete(listener);
		}
		dispatch(event) {
			events.push(event);
			for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event);
		}
	}

	const stores = {
		streaming: new StreamingStore(),
		runningGames: new RunningGameStore(),
		quests: new QuestsStore(),
		channels: new ChannelStore(),
		dispatcher: new Dispatcher(),
	};

	const api = {
		get: async (request) => {
			calls.push({ client: "discord", verb: "get", ...request });
			return onGet(request);
		},
		post: async (request) => {
			calls.push({ client: "discord", verb: "post", ...request });
			return onPost(request);
		},
		put: async () => ({ body: {} }),
		patch: async () => ({ body: {} }),
		del: async () => ({ body: {} }),
	};

	const exploding = {};
	Object.defineProperty(exploding, "boom", {
		enumerable: true,
		get() {
			throw new Error("getter that throws");
		},
	});

	const scope = { $: () => {} };
	const cache = {
		// The decoy comes first so a loose HTTP lookup would pick it.
		1: { exports: makeSuperagentDecoy(calls) },
		2: { exports: scope },
		3: { exports: exploding },
		4: { exports: undefined },
		5: { exports: "a string export" },
		6: { exports: { a9: stores.streaming } },
		7: { exports: { Kq: stores.runningGames } },
		8: { exports: { _w: stores.quests, other: 42 } },
		9: { exports: { default: stores.channels } },
		10: { exports: { zz: stores.dispatcher } },
		11: { exports: { [httpKey]: api, unrelated: new Map() } },
	};
	if (withGuildChannels) {
		cache[12] = {
			exports: {
				pp: {
					getSFWDefaultChannel() {},
					getAllGuilds: () => ({ g1: { VOCAL: [{ channel: { id: "voice-1" } }] } }),
				},
			},
		};
	}

	const require = { c: cache };
	const chunkArray = [];
	scope.webpackChunkdiscord_app = {
		push(chunk) {
			chunkArray.push(chunk);
			return chunk[2](require);
		},
		pop: () => chunkArray.pop(),
	};
	if (desktop) scope.DiscordNative = {};

	const logs = [];
	const record = (level) => (...args) => logs.push({ level, text: args.map(String).join(" ") });
	const log = { info: record("info"), warn: record("warn"), error: record("error") };

	return {
		scope,
		require,
		stores,
		api,
		calls,
		events,
		listeners,
		log,
		logs,
		chunkArray,
		/** Emits a heartbeat the way the client does after a successful one. */
		heartbeat(type, value) {
			stores.dispatcher.dispatch({
				type: "QUESTS_SEND_HEARTBEAT_SUCCESS",
				userStatus: { progress: { [type]: { value } }, streamProgressSeconds: value },
			});
		},
	};
}

export const instantSleep = () => Promise.resolve();

/** Lets pending promise callbacks run. */
export const tick = () => new Promise((resolve) => setImmediate(resolve));
