import { createLogger } from "./core/logger.js";
import { run } from "./runner.js";

const log = createLogger();

run({ log }).catch((error) => {
	log.error(error.message ?? error);
});
