import { createFinder } from "./core/finder.js";
import { createLogger } from "./core/logger.js";
import { acquireRequire } from "./core/webpack.js";
import { resolveModules } from "./discord/modules.js";
import { selectPendingQuests } from "./quests.js";
import { TASKS } from "./tasks/index.js";

const RUN_FLAG = "__orbweaver_running__";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs every pending quest, one after another.
 *
 * @param {object} [options]
 * @param {Record<string, any>} [options.scope] Global object of the Discord client.
 * @param {import("./core/logger.js").Logger} [options.log]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.random]
 * @returns {Promise<{ completed: string[], skipped: string[], failed: string[] }>}
 */
export async function run({
	scope = globalThis,
	log = createLogger(),
	sleep = defaultSleep,
	random = Math.random,
} = {}) {
	const summary = { completed: [], skipped: [], failed: [] };

	if (scope[RUN_FLAG]) {
		log.warn("Already running in this window. Reload Discord to start over.");
		return summary;
	}
	scope[RUN_FLAG] = true;

	try {
		const require = acquireRequire(scope);
		const find = createFinder(require, { ignore: [scope], warn: log.warn });
		const modules = resolveModules(find);
		const isDesktop = typeof scope.DiscordNative !== "undefined";

		const quests = selectPendingQuests(modules.questsStore);
		if (quests.length === 0) {
			log.info("No accepted quests left to complete.");
			return summary;
		}
		log.info(`Found ${quests.length} quest(s): ${quests.map((quest) => quest.name).join(", ")}`);

		for (const quest of quests) {
			const task = TASKS[quest.type];

			if (task.desktopOnly && !isDesktop) {
				log.warn(`${quest.name}: this quest type only works in the desktop app. Skipped.`);
				summary.skipped.push(quest.name);
				continue;
			}

			try {
				await task.run({ quest, modules, log, sleep, random });
				log.info(`${quest.name}: completed.`);
				summary.completed.push(quest.name);
			} catch (error) {
				log.error(`${quest.name}: failed.`, error);
				summary.failed.push(quest.name);
			}
		}

		log.info(
			`Done. ${summary.completed.length} completed, ${summary.skipped.length} skipped, ${summary.failed.length} failed.`,
		);
		return summary;
	} finally {
		scope[RUN_FLAG] = false;
	}
}
