// simulate-group2-with-echo.mjs - test the new plan where Test3 is in group 2

const planItems = [
  { name: "test1", sets: 2, groupNumber: "1" },
  { name: "test2", sets: 3, groupNumber: "1" },
  { name: "Test3", sets: 2, groupNumber: "2" }, // NOW IN GROUP 2
  { type: "echo", name: "not super", sets: 2 }, // NOT GROUPED
  { name: "superset2", sets: 3, groupNumber: "2" },
  { type: "echo", name: "superset2b", sets: 2, groupNumber: "2" },
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
  getRemainingSets(itemIndex) {
    for (const gs of this.groupState.values()) {
      const rem = gs.setsRemaining.get(itemIndex);
      if (rem !== undefined) return rem;
    }
    return 0;
  }
  getState() {
    const s = {};
    for (const [k, v] of this.groupState) {
      s[k] = Array.from(v.setsRemaining.entries());
    }
    return s;
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
console.log("Timeline entries:");
timeline.forEach((t, i) =>
  console.log(
    `${i}: item ${t.itemIndex} set ${t.set} (${
      planItems[t.itemIndex].name || planItems[t.itemIndex].type
    })`,
  ),
);

const exec = new SupersetExecutorV2Sim(planItems);
console.log("\nInitial state:", exec.getState());

let ti = 0;
let groupExecutionMode = true;
const events = [];

function findTimelineIndexFor(itemIndex, setNumber) {
  return timeline.findIndex(
    (e) => e.itemIndex === itemIndex && Number(e.set) === Number(setNumber),
  );
}

function findGroupLastTimelineIdx(group) {
  const groupItemSet = new Set(group.items.map((it) => it.index));
  let lastIdx = -1;
  for (let i = 0; i < timeline.length; i++) {
    if (groupItemSet.has(timeline[i].itemIndex)) lastIdx = i;
  }
  return lastIdx;
}

while (ti < timeline.length) {
  const entry = timeline[ti];
  const item = planItems[entry.itemIndex];
  const isGrouped = exec.isGrouped(entry.itemIndex);

  events.push(
    `[ti=${ti}] RUN ${item.name || item.type} set ${entry.set}`,
  );

  if (isGrouped) {
    const next = exec.getNextExercise(entry.itemIndex);
    events.push(`  → executor: ${JSON.stringify(next)}`);

    if (next.action === "next-exercise" || next.action === "rest-then-continue") {
      const idx = findTimelineIndexFor(
        next.itemIndex,
        exec.getRemainingSets(next.itemIndex),
      );

      if (idx !== -1 && idx !== ti) {
        // Check for non-grouped items between current and target
        const minIdx = Math.min(ti, idx);
        const maxIdx = Math.max(ti, idx);
        let firstNonGroupedIdx = -1;

        for (let i = minIdx + 1; i < maxIdx; i++) {
          const te = timeline[i];
          if (te && !exec.isGrouped(te.itemIndex)) {
            firstNonGroupedIdx = i;
            break;
          }
        }

        if (firstNonGroupedIdx !== -1) {
          events.push(
            `  → found unexecuted non-grouped at ti=${firstNonGroupedIdx}, advancing to it`,
          );
          ti = firstNonGroupedIdx - 1; // Will be incremented below
        } else {
          events.push(`  → jump to ti=${idx}`);
          ti = idx - 1; // Will be incremented below
        }
      }
    } else if (next.action === "complete") {
      events.push(`  → group complete`);
    }
  }

  ti += 1;
}

console.log("\n=== Events Log ===\n" + events.join("\n"));
