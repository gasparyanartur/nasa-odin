import {expect,it} from 'vitest';
import {tileRetryBudget} from './tile-retries';

it('bounds retries per failed tile even when other tiles report interleaved errors',()=>{
  const retry=tileRetryBudget(),bad={level:1,x:3,y:1},other={level:2,x:7,y:2};
  expect(retry(bad)).toBe(true);expect(retry(other)).toBe(true);
  expect(retry(bad)).toBe(true);expect(retry(other)).toBe(true);
  expect(retry(bad)).toBe(false);expect(retry(other)).toBe(false);
  expect(retry(bad)).toBe(false);
  expect(tileRetryBudget()(bad)).toBe(true);
});
