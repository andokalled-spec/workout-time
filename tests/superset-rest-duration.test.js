import test from 'node:test';
import assert from 'node:assert/strict';
import SupersetExecutorV3 from '../workout-time/superset-executor-v3.js';

// Focused test: interleaved group members should use the last-executed member's restSec
// between rounds. We simulate a plan with group 1 members interleaved and assert
// that completeGroupRound returns restSeconds matching the last executed exercise's restSec.

test('superset: rest duration equals last-executed member restSec for interleaved groups', () => {
  const planItems = [
    { name: 'A1', type: 'exercise', sets: 2, restSec: 10, groupNumber: '1' },
    { name: 'Ungrouped-X', type: 'exercise', sets: 1, restSec: 5 },
    { name: 'A2', type: 'exercise', sets: 2, restSec: 20, groupNumber: '1' },
  ];

  const exec = new SupersetExecutorV3(planItems);

  // Start by asserting next action is group-superset-start for group '1'
  const next = exec.getNextAction();
  assert.equal(next.action, 'group-superset-start');
  assert.equal(next.groupNumber, '1');

  // Simulate one round: execute one set for A1 then one for A2
  // Mark sets completed using exec.completeSet(index)
  exec.completeSet(0); // A1 set 1
  exec.completeSet(2); // A2 set 1

  // Now simulate end-of-round: last executed is index 2 (A2), so completeGroupRound should
  // return restSeconds equal to A2.restSec (20)
  const roundResult = exec.completeGroupRound(2, '1');
  assert.equal(roundResult.action, 'rest-then-continue');
  assert.equal(roundResult.restSeconds, 20);

  // Continue another round: complete A1 (index 0) and A2 (index 2) remaining sets
  exec.completeSet(0); // A1 set 2
  exec.completeSet(2); // A2 set 2

  // Now group should be complete
  const completeResult = exec.completeGroupRound(2, '1');
  assert.equal(completeResult.action, 'group-complete');
});
