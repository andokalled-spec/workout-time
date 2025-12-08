/**
 * Superset/Group Execution Logic - Version 3
 *
 * Core Idea:
 * Always look for the next incomplete exercise in plan order.
 * - If ungrouped: run alone to completion.
 * - If grouped: collect all exercises with that group number (in plan order) and run
 *   the entire group as an atomic superset unit.
 * After finishing, scan from the top again to find the next incomplete exercise.
 * Repeat until all exercises are complete.
 *
 * This solves the case where group members are split by ungrouped exercises:
 * even if Group1-ExA is followed by Ungrouped-X then Group1-ExB,
 * both ExA and ExB are collected and run together as a coherent superset.
 */

class SupersetExecutorV3 {
  constructor(planItems = []) {
    this.planItems = planItems;
    // Track completed sets per exercise (by plan index)
    this.completedSets = new Map(); // exerciseIndex -> number of completed sets
    this.initializeCompletionState();
  }

  /**
   * Initialize completion state: each exercise starts with 0 completed sets
   */
  initializeCompletionState() {
    this.planItems.forEach((item, index) => {
      this.completedSets.set(index, 0);
    });
  }

  /**
   * Find the next incomplete exercise in plan order
   * Returns the index of the first exercise where completedSets < totalSets
   * Returns null if all exercises are complete
   */
  findNextIncompleteExercise() {
    for (let i = 0; i < this.planItems.length; i += 1) {
      const item = this.planItems[i];
      const totalSets = Number(item.sets) || 1;
      const completed = this.completedSets.get(i) || 0;
      if (completed < totalSets) {
        return i;
      }
    }
    return null;
  }

  /**
   * Get all exercises belonging to a specific group, in plan order
   * (even if other exercises are interspersed between them)
   */
  getGroupExercises(groupNumber) {
    if (groupNumber === null || groupNumber === undefined) return [];
    const groupId = String(groupNumber).trim();
    if (!groupId) return [];
    const indices = [];
    for (let i = 0; i < this.planItems.length; i += 1) {
      const item = this.planItems[i];
      const itemGroupId = (item && item.groupNumber) ? String(item.groupNumber).trim() : '';
      if (itemGroupId === groupId) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Check if an exercise is grouped (has a non-empty groupNumber)
   */
  isGrouped(itemIndex) {
    const item = this.planItems[itemIndex];
    if (!item) return false;
    const groupId = item.groupNumber && String(item.groupNumber).trim();
    return Boolean(groupId);
  }

  /**
   * Get total sets for an exercise
   */
  getTotalSets(itemIndex) {
    const item = this.planItems[itemIndex];
    return item ? Number(item.sets) || 1 : 0;
  }

  /**
   * Get completed sets for an exercise
   */
  getCompletedSets(itemIndex) {
    return this.completedSets.get(itemIndex) || 0;
  }

  /**
   * Get remaining sets for an exercise
   */
  getRemainingSets(itemIndex) {
    const total = this.getTotalSets(itemIndex);
    const completed = this.getCompletedSets(itemIndex);
    return Math.max(0, total - completed);
  }

  /**
   * Mark one set as completed for an exercise
   */
  completeSet(itemIndex) {
    const current = this.completedSets.get(itemIndex) || 0;
    const total = this.getTotalSets(itemIndex);
    if (current < total) {
      this.completedSets.set(itemIndex, current + 1);
    }
  }

  /**
   * Main progression logic: returns the next action to take
   *
   * Returns one of:
   * {
   *   action: 'exercise-start',
   *   exerciseIndex: number,
   *   setNumber: number,
   *   isSingleExercise: boolean,  // true if ungrouped, false if part of group
   *   groupSize: number  // how many exercises in this group (1 for ungrouped)
   * }
   *
   * {
   *   action: 'group-superset-start',
   *   groupNumber: string,
   *   groupExercises: [{ index, totalSets, completedSets, remainingSets }, ...],
   *   currentExerciseIndex: number  // which one to start with
   * }
   *
   * {
   *   action: 'complete'
   * }
   */
  getNextAction() {
    const nextIncomplete = this.findNextIncompleteExercise();

    if (nextIncomplete === null) {
      return { action: 'complete' };
    }

    const item = this.planItems[nextIncomplete];

    // Check if this exercise is grouped
    if (!this.isGrouped(nextIncomplete)) {
      // Single ungrouped exercise
      const setNumber = this.getCompletedSets(nextIncomplete) + 1;
      return {
        action: 'exercise-start',
        exerciseIndex: nextIncomplete,
        setNumber,
        isSingleExercise: true,
        groupSize: 1
      };
    }

    // Exercise is part of a group
    const groupNumber = item.groupNumber;
    const groupExercises = this.getGroupExercises(groupNumber);

    // Build info for each exercise in the group
    const groupInfo = groupExercises.map((idx) => ({
      index: idx,
      name: this.planItems[idx].name || 'Exercise',
      totalSets: this.getTotalSets(idx),
      completedSets: this.getCompletedSets(idx),
      remainingSets: this.getRemainingSets(idx)
    }));

    return {
      action: 'group-superset-start',
      groupNumber: String(groupNumber).trim(),
      groupExercises: groupInfo,
      currentExerciseIndex: nextIncomplete  // Start with the first incomplete exercise in the group
    };
  }

  /**
   * Execute one round of superset cycling within a group
   * Called repeatedly until the group is complete
   *
   * Returns:
   * {
   *   action: 'next-exercise' | 'rest-then-continue' | 'group-complete',
   *   exerciseIndex: number (for 'next-exercise' and 'rest-then-continue'),
   *   setNumber: number,
   *   restSeconds: number | null,
   *   lastExerciseIndex: number | null  (for 'rest-then-continue')
   * }
   */
  getNextGroupAction(groupNumber) {
    const groupExercises = this.getGroupExercises(groupNumber);

    // Track which exercise we just completed (should be passed in real usage)
    // For now, find all exercises that still need sets
    let lastExerciseCompleted = null;
    let anyRemaining = false;

    for (const idx of groupExercises) {
      const remaining = this.getRemainingSets(idx);
      if (remaining > 0) {
        anyRemaining = true;
      }
    }

    if (!anyRemaining) {
      // Group is complete
      return { action: 'group-complete' };
    }

    // Find next exercise in group order with remaining sets
    for (const idx of groupExercises) {
      const remaining = this.getRemainingSets(idx);
      if (remaining > 0) {
        const setNumber = this.getCompletedSets(idx) + 1;
        const item = this.planItems[idx];
        return {
          action: 'next-exercise-in-group',
          exerciseIndex: idx,
          setNumber,
          restSeconds: null  // No rest between exercises in a round
        };
      }
    }

    // This shouldn't happen if anyRemaining is true
    return { action: 'group-complete' };
  }

  /**
   * Mark the end of a group round and get the next action
   * (Called after the last exercise in a round is completed)
   *
   * If the group is not yet complete, returns 'rest-then-continue'.
   * Otherwise returns 'group-complete'.
   */
  completeGroupRound(lastExerciseIndex, groupNumber) {
    const groupExercises = this.getGroupExercises(groupNumber);

    // Check if any exercise in the group still has sets remaining
    let anyRemaining = false;
    for (const idx of groupExercises) {
      const remaining = this.getRemainingSets(idx);
      if (remaining > 0) {
        anyRemaining = true;
        break;
      }
    }

    if (!anyRemaining) {
      return {
        action: 'group-complete'
      };
    }

    // Still have sets remaining - rest then continue
    const lastItem = this.planItems[lastExerciseIndex];
    const restSeconds = Number(lastItem?.restSec) || 60;
    const firstExerciseInGroup = groupExercises[0];

    return {
      action: 'rest-then-continue',
      exerciseIndex: firstExerciseInGroup,
      restSeconds,
      lastExerciseIndex
    };
  }

  /**
   * Get current state for debugging/display
   */
  getState() {
    const state = [];
    for (let i = 0; i < this.planItems.length; i += 1) {
      const item = this.planItems[i];
      const total = this.getTotalSets(i);
      const completed = this.getCompletedSets(i);
      state.push({
        index: i,
        name: item.name || 'Exercise',
        groupNumber: item.groupNumber || null,
        totalSets: total,
        completedSets: completed,
        remainingSets: total - completed
      });
    }
    return state;
  }

  /**
   * Reset completion state (for restarting a plan)
   */
  reset() {
    this.initializeCompletionState();
  }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.SupersetExecutorV3 = SupersetExecutorV3;
}

export default SupersetExecutorV3;
