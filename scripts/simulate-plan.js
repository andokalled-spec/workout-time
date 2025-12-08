// Simple Node simulation of the "atomic group" superset execution model (V3-like)
// Prints a step-by-step trace for the given plan data.

const plan = {
  name: 'super test2',
  items: [
    {
      type: 'exercise',
      name: 'test1',
      sets: 2,
      reps: 4,
      restSec: 10,
      groupNumber: '1',
    },
    {
      type: 'exercise',
      name: 'test2',
      sets: 3,
      reps: 4,
      restSec: 90,
      groupNumber: '1',
    },
    {
      type: 'exercise',
      name: 'Test3',
      sets: 2,
      reps: 4,
      restSec: 30,
      groupNumber: '2',
    },
    {
      type: 'echo',
      name: 'not super',
      sets: 2,
      restSec: 15,
      groupNumber: '3',
    },
    {
      type: 'exercise',
      name: 'superset2',
      sets: 3,
      reps: 3,
      restSec: 90,
      groupNumber: '2',
    },
    {
      type: 'echo',
      name: 'superset2b',
      sets: 2,
      restSec: 20,
      groupNumber: '1',
    },
  ],
};

// Build per-item set trackers
const totalSets = plan.items.map((it) => (typeof it.sets === 'number' ? it.sets : 1));
const completed = new Array(plan.items.length).fill(0);

function isGrouped(index) {
  const g = plan.items[index].groupNumber;
  return g != null && String(g).trim() !== '';
}

function getGroupExercises(groupNumber) {
  if (!groupNumber || String(groupNumber).trim() === '') return [];
  // collect indices in plan order that match the groupNumber
  const res = [];
  for (let i = 0; i < plan.items.length; i++) {
    if (String(plan.items[i].groupNumber) === String(groupNumber)) res.push(i);
  }
  return res;
}

function findNextIncompleteExercise() {
  for (let i = 0; i < plan.items.length; i++) {
    if (completed[i] < totalSets[i]) return i;
  }
  return -1;
}

function simulate() {
  let step = 0;
  const trace = [];

  while (true) {
    const next = findNextIncompleteExercise();
    if (next === -1) break; // done

    // If it's grouped, complete the entire group (multiple rounds) before moving on.
    if (isGrouped(next)) {
      const groupNumber = plan.items[next].groupNumber;
      const groupExercises = getGroupExercises(groupNumber);
      trace.push(`-- Start Group ${groupNumber} (members indices: ${groupExercises.join(', ')})`);

      // Keep doing rounds until all group members are complete
      while (true) {
        let lastExecutedIdx = -1;
        // Perform one set for each member in plan order, skipping fully completed
        for (let idx of groupExercises) {
          if (completed[idx] >= totalSets[idx]) {
            trace.push(`skip ${idx}:${plan.items[idx].name} (already complete)`);
            continue;
          }
          // Do one set
          completed[idx]++;
          step++;
          lastExecutedIdx = idx;
          trace.push(`${step}. ${plan.items[idx].name} - set ${completed[idx]}/${totalSets[idx]} (type=${plan.items[idx].type})`);
        }

        // If nothing executed this round, break to avoid infinite loop
        if (lastExecutedIdx === -1) break;

        // After the round, always schedule rest (use the restSec of the last executed member)
        const rest = plan.items[lastExecutedIdx].restSec || 0;
        trace.push(`  → Group ${groupNumber} round complete; rest ${rest}s before next round`);

        // If all members complete, break out of group loop
        const allComplete = groupExercises.every((i) => completed[i] >= totalSets[i]);
        if (allComplete) break;
      }

      continue;
    }

    // Not grouped: do all remaining sets serially
    const item = plan.items[next];
    while (completed[next] < totalSets[next]) {
      completed[next]++;
      step++;
      trace.push(`${step}. ${item.name} - set ${completed[next]}/${totalSets[next]} (type=${item.type})`);
      // after each set, if still remaining sets, simulate rest
      if (completed[next] < totalSets[next]) {
        trace.push(`  → rest ${item.restSec || 0}s before next set`);
      }
    }
  }

  trace.push('-- Workout complete');
  return trace;
}

const out = simulate();
console.log(out.join('\n'));
