import { inject } from "vitest";
import { withDatabase, workerDatabaseName } from "./workers.js";

// Each vitest worker owns one of the databases cloned in global.ts, so files
// can run in parallel without seeing each other's rows. This file is listed
// first in setupFiles so DATABASE_URL is set before anything reads it.
const poolId = Number(process.env.VITEST_POOL_ID ?? 1);

process.env.DATABASE_URL = withDatabase(
    inject("databaseUri"),
    workerDatabaseName(poolId),
);
