/**
 * Group validation utilities
 * Detects and warns about improper group configurations in plans
 */

/**
 * Check if plan items have interleaved groups
 * Groups must be contiguous in the timeline for proper execution
 * @param {Array} planItems - Array of plan items with optional groupNumber
 * @returns {Object} { isValid: boolean, issues: Array, message: string }
 */
export const validateGroupConfiguration = (planItems) => {
  if (!Array.isArray(planItems) || planItems.length === 0) {
    return { isValid: true, issues: [], message: "" };
  }

  const issues = [];
  const groupMap = new Map(); // groupId -> { firstIndex, lastIndex, indices: [] }

  // First pass: identify all groups and their positions in the timeline
  planItems.forEach((item, timelineIndex) => {
    const groupId = item.groupNumber && String(item.groupNumber).trim();

    if (groupId) {
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          firstIndex: timelineIndex,
          lastIndex: timelineIndex,
          indices: [timelineIndex],
        });
      } else {
        const group = groupMap.get(groupId);
        group.lastIndex = timelineIndex;
        group.indices.push(timelineIndex);
      }
    }
  });

  // Second pass: check for gaps (interleaved groups)
  for (const [groupId, groupInfo] of groupMap) {
    const { firstIndex, lastIndex, indices } = groupInfo;
    const expectedContiguousLength = lastIndex - firstIndex + 1;

    // If number of items in range doesn't match actual items in group, there are gaps
    if (indices.length !== expectedContiguousLength) {
      const gaps = [];
      for (let i = firstIndex; i <= lastIndex; i++) {
        if (!indices.includes(i)) {
          const item = planItems[i];
          const itemName = item?.name || item?.type || `Item ${i}`;
          gaps.push(
            `  • Timeline index ${i}: ${itemName} (group: ${item?.groupNumber || "none"})`,
          );
        }
      }

      issues.push({
        severity: "warning",
        groupId,
        message: `Group ${groupId} is interleaved with other items. Items must be contiguous.`,
        details: {
          span: `Timeline indices ${firstIndex}-${lastIndex}`,
          groupItemCount: indices.length,
          spaceOccupied: expectedContiguousLength,
          interleavedItems: gaps,
        },
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    message:
      issues.length === 0
        ? "Group configuration is valid"
        : `Found ${issues.length} group configuration issue(s)`,
  };
};

/**
 * Format validation issues for user display
 * @param {Object} validationResult - Result from validateGroupConfiguration
 * @returns {string} Formatted message for user
 */
export const formatGroupValidationMessage = (validationResult) => {
  if (validationResult.isValid) {
    return "✓ Group configuration is valid";
  }

  const lines = [
    "⚠️ Warning: Improper group configuration detected:\n",
  ];

  validationResult.issues.forEach((issue) => {
    lines.push(`Group ${issue.groupId}:`);
    lines.push(`  ${issue.message}`);
    lines.push(`  ${issue.details.span}`);
    lines.push(
      `  Items in group: ${issue.details.groupItemCount}, Space occupied: ${issue.details.spaceOccupied}`,
    );
    lines.push("  Interleaved items:");
    lines.push(issue.details.interleavedItems.join("\n"));
    lines.push(
      "\n💡 Tip: Reorder your exercises so all items in a group appear consecutively.",
    );
    lines.push("");
  });

  return lines.join("\n");
};
