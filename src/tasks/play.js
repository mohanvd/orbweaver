/**
 * PLAY_ON_DESKTOP.
 *
 * The client decides whether you are playing a game by asking RunningGameStore.
 * For the duration of the quest the store reports one extra process that matches
 * the quest's application, then everything is put back the way it was.
 */

import { patch } from "../core/patch.js";
import { waitForHeartbeats } from "./heartbeat.js";

const ILLEGAL_FILENAME_CHARS = /[\/\\:*?"<>|]/g;

function describeProcess(app, applicationId, pid) {
	const exeName =
		app.executables?.find((exe) => exe.os === "win32")?.name?.replace(">", "") ??
		app.name.replace(ILLEGAL_FILENAME_CHARS, "");

	return {
		cmdLine: `C:\\Program Files\\${app.name}\\${exeName}`,
		exeName,
		exePath: `c:/program files/${app.name.toLowerCase()}/${exeName}`,
		hidden: false,
		isLauncher: false,
		id: applicationId,
		name: app.name,
		pid,
		pidPath: [pid],
		processName: app.name,
		start: Date.now(),
	};
}

/** @param {import("./index.js").TaskContext} ctx */
export async function runPlay(ctx) {
	const { quest, modules, log, random } = ctx;
	const { api, runningGameStore, dispatcher } = modules;

	const response = await api.get({
		url: `/applications/public?application_ids=${quest.applicationId}`,
	});
	const app = response.body[0];
	if (!app) throw new Error(`Discord returned no application for ${quest.name}.`);

	const pid = Math.floor(random() * 30000) + 1000;
	const game = describeProcess(app, quest.applicationId, pid);
	const realGames = runningGameStore.getRunningGames();

	const restore = [
		patch(runningGameStore, "getRunningGames", () => [game]),
		patch(runningGameStore, "getGameForPID", (id) => (id === pid ? game : undefined)),
	];
	dispatcher.dispatch({
		type: "RUNNING_GAMES_CHANGE",
		removed: realGames,
		added: [game],
		games: [game],
	});

	const minutes = Math.ceil((quest.target - quest.done) / 60);
	log.info(`${quest.name}: reporting ${app.name} as running. About ${minutes} min left.`);

	try {
		await waitForHeartbeats(ctx);
	} finally {
		restore.forEach((undo) => undo());
		dispatcher.dispatch({
			type: "RUNNING_GAMES_CHANGE",
			removed: [game],
			added: [],
			games: [],
		});
	}
}
