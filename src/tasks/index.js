import { runActivity } from "./activity.js";
import { runPlay } from "./play.js";
import { runStream } from "./stream.js";
import { runVideo } from "./video.js";

/**
 * @typedef {object} TaskContext
 * @property {NonNullable<ReturnType<typeof import("../quests.js").describeQuest>>} quest
 * @property {Record<string, any>} modules Resolved Discord internals.
 * @property {import("../core/logger.js").Logger} log
 * @property {(ms: number) => Promise<void>} sleep
 * @property {() => number} random
 */

/**
 * @typedef {object} TaskRunner
 * @property {(ctx: TaskContext) => Promise<void>} run
 * @property {boolean} desktopOnly True when the task needs the desktop client.
 */

/** @type {Record<string, TaskRunner>} */
export const TASKS = {
	WATCH_VIDEO: { run: runVideo, desktopOnly: false },
	WATCH_VIDEO_ON_MOBILE: { run: runVideo, desktopOnly: false },
	PLAY_ON_DESKTOP: { run: runPlay, desktopOnly: true },
	STREAM_ON_DESKTOP: { run: runStream, desktopOnly: true },
	PLAY_ACTIVITY: { run: runActivity, desktopOnly: false },
};
