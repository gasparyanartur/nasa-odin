import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const vitest=['node_modules/vitest/vitest.mjs','../node_modules/vitest/vitest.mjs'].find(existsSync)??'node_modules/vitest/vitest.mjs';
const result=spawnSync(process.execPath,[vitest,'run','src/mission/planner/core.test.ts'],{stdio:'inherit',env:{...process.env,PLANNER_PYTHON_REFERENCE:'1'}});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
