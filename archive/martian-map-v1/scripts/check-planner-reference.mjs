import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','src/mission/planner/core.test.ts'],{stdio:'inherit',env:{...process.env,PLANNER_PYTHON_REFERENCE:'1'}});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
