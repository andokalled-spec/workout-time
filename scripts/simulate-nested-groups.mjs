// simulate-nested-groups.mjs - what happens if group 2 items are mixed within group 1

const planItems = [
  { name: "test1", sets: 2, groupNumber: "1" },
  { name: "test2", sets: 2, groupNumber: "1" },
  { name: "groupTwo_item1", sets: 2, groupNumber: "2" }, // Group 2 nested in Group 1
  { name: "test3", sets: 2, groupNumber: "1" },
  { name: "groupTwo_item2", sets: 2, groupNumber: "2" }, // Another Group 2 item in Group 1
];

class SupersetExecutorV2Sim {
  constructor(planItems = []) {
    this.planItems = planItems;
    this.groups = this.buildGroups(planItems);
    this.groupState = new Map();
    this.initializeAllGroupStates();
  }
  buildGroups(planItems) {
    const groupMap = new Map();
    const groups = [];
    planItems.forEach((item, index) => {
      const groupId = item.groupNumber && String(item.groupNumber).trim();
      if (groupId) {
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
          groups.push({
            id: groupId,
            items: groupMap.get(groupId),
            isGroup: true,
          });
        }
        groupMap.get(groupId).push({ index, item });
      } else {
        groups.push({
          id: `standalone-${index}`,
          items: [{ index, item }],
          isGroup: false,
        });
      }
    });
    return groups;
  }
  initializeAllGroupStates() {
    this.groups.forEach((group) => {
      if (group.isGroup) {
        const setsRemaining = new Map();
        group.items.forEach(({ index, item }) => {
          setsRemaining.set(index, Number(item.sets) || 1);
        });
        this.groupState.set(group.id, { setsRemaining });
      }
    });
  }
  findGroupForItem(itemIndex) {
    for (const group of this.groups) {
      if (
        group.isGroup &&
        group.items.some((e) => e.index === itemIndex)
      ) {
        return group;
      }
    }
    return null;
  }
  isGrouped(itemIndex) {
    for (const group of this.groups) {
      if (
        group.isGroup &&
        group.items.some((e) => e.index === itemIndex)
      ) {
        return true;
      }
    }
    return false;
  }
  getNextExercise(completedItemIndex) {
    const group = this.findGroupForItem(completedItemIndex);
    if (!group) return { action: "complete" };
    const groupState = this.groupState.get(group.id);
    if (!groupState) return { action: "complete" };
    const currentRemaining =
      groupState.setsRemaining.get(completedItemIndex) || 0;
    if (currentRemaining > 0)
      groupState.setsRemaining.set(
        completedItemIndex,
        currentRemaining - 1,
      );
    const currentPos = group.items.findIndex(
      (e) => e.index === completedItemIndex,
    );
    let nextIdx = null;
    for (let i = currentPos + 1; i < group.items.length; i++) {
      const ii = group.items[i].index;
      if ((groupState.setsRemaining.get(ii) || 0) > 0) {
        nextIdx = ii;
        break;
      }
    }
    if (nextIdx !== null)
      return { itemIndex: nextIdx, action: "next-exercise" };
    const anyRemaining = Array.from(
      groupState.setsRemaining.values(),
    ).some((c) => c > 0);
    if (!anyRemaining) return { action: "complete" };
    const firstIdx = group.items[0].index;
    const firstRem = groupState.setsRemaining.get(firstIdx) || 0;
    if (firstRem > 0)
      return {
        itemIndex: firstIdx,
        action: "rest-then-continue",
        restAfter: completedItemIndex,
      };
    for (const { index } of group.items) {
      if ((groupState.setsRemaining.get(index) || 0) > 0)
        return {
          itemIndex: index,
          action: "rest-then-continue",
          restAfter: completedItemIndex,
        };
    }
    return { action: "complete" };
  }
}

function buildPlanTimeline(items) {
  const timeline = [];
  items.forEach((it, i) => {
    const sets = Math.max(1, Number(it.sets) || 1);
    for (let s = 1; s <= sets; s++) {
      timeline.push({ itemIndex: i, set: s });
    }
  });
  return timeline;
}

const timeline = buildPlanTimeline(planItems);
console.log("=== PLAN STRUCTURE ===");
console.log(
  "Items: test1 (group 1), test2 (group 1), groupTwo_item1 (group 2), test3 (group 1), groupTwo_item2 (group 2)",
);
console.log(
  "\nNotice: Group 2 items are INTERSPERSED within Group 1 items in the timeline\n",
);

console.log("Timeline entries:");
timeline.forEach((t, i) =>
  console.log(
    `${i}: item ${t.itemIndex} set ${t.set} (${
      planItems[t.itemIndex].name
    }) — group=${planItems[t.itemIndex].groupNumber}`,
  ),
);

const exec = new SupersetExecutorV2Sim(planItems);
console.log("\nGroups recognized by executor:");
exec.groups.forEach((g) => {
  if (g.isGroup) {
    const items = g.items.map((e) => `${e.item.name} (idx ${e.index})`).join(", ");
    console.log(`  Group ${g.id}: ${items}`);
  }
});

console.log("\nInitial state:", exec.getState ? exec.getState() : "N/A");

console.log("\n=== EXECUTION SIMULATION ===\n");

let ti = 0;
let groupExecutionMode = true;
const events = [];

function findTimelineIndexFor(itemIndex, setNumber) {
  return timeline.findIndex(
    (e) => e.itemIndex === itemIndex && Number(e.set) === Number(setNumber),
  );
}

let iterations = 0;
const maxIterations = 100; // Safety limit to prevent infinite loops

while (ti < timeline.length && iterations < maxIterations) {
  iterations++;
  const entry = timeline[ti];
  const item = planItems[entry.itemIndex];
  const isGrouped = exec.isGrouped(entry.itemIndex);
  const group = exec.findGroupForItem(entry.itemIndex);

  events.push(
    `Step ${iterations}: [ti=${ti}] RUN ${item.name} set ${entry.set} (groupNumber=${item.groupNumber || "none"})`,
  );

  if (isGrouped) {
    const next = exec.getNextExercise(entry.itemIndex);
    events.push(
      `  → Item is in group "${group.id}", executor returns: ${JSON.stringify(next)}`,
    );

    if (
      next.action === "next-exercise" &&
      next.itemIndex !== undefined
    ) {
      const targetItem = planItems[next.itemIndex];
      const targetIdx = timeline.findIndex(
        (e) => e.itemIndex === next.itemIndex,
      );
      events.push(
        `  → Jump to item ${next.itemIndex} (${targetItem.name}) at timeline index ${targetIdx}`,
      );
      if (targetIdx !== -1) {
        ti = targetIdx;
      } else {
        ti += 1;
      }
      continue;
    } else if (next.action === "complete") {
      events.push(`  → Group ${group.id} is complete`);
    }
  } else {
    events.push("  → Item is not grouped, regular execution");
  }

  ti += 1;
}

console.log(events.join("\n"));

if (iterations >= maxIterations) {
  console.log(
    "\n⚠️  WARNING: Simulation hit iteration limit (possible infinite loop)",
  );
} else {
  console.log("\n=== ANALYSIS ===");
  console.log("What happened:");
  console.log(
    "1. Executor recognizes group 1 with items: test1, test2, test3, groupTwo_item1, groupTwo_item2",
  );
  console.log(
    "2. Executor recognizes group 2 with items: groupTwo_item1, groupTwo_item2",
  );
  console.log(
    "3. When test1 completes, executor tries to cycle through group 1 items in order",
  );
  console.log(
    "4. But group 2 items are physically located in the middle of group 1 in the timeline",
  );
  console.log(
    "5. The executor will jump test1 → test2 → groupTwo_item1 (it's in group 1) → test3 → groupTwo_item2",
  );
  console.log(
    "\n✗ PROBLEM: Group 2 items execute as part of Group 1's round-robin cycle",
  );
  console.log(
    "           This breaks the intended superset behavior where Group 2 should be independent",
  );
}
