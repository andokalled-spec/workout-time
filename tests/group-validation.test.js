import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateGroupConfiguration,
  formatGroupValidationMessage,
} from '../js/group-validation.js';

test('group validation: empty plan is valid', () => {
  const result = validateGroupConfiguration([]);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.issues.length, 0);
});

test('group validation: no groups is valid', () => {
  const items = [
    { name: 'test1', sets: 2 },
    { name: 'test2', sets: 2 },
  ];
  const result = validateGroupConfiguration(items);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.issues.length, 0);
});

test('group validation: contiguous groups are valid', () => {
  const items = [
    { name: 'test1', sets: 2, groupNumber: '1' },
    { name: 'test2', sets: 2, groupNumber: '1' },
    { name: 'test3', sets: 2, groupNumber: '1' },
    { name: 'echo1', sets: 2 },
  ];
  const result = validateGroupConfiguration(items);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.issues.length, 0);
});

test('group validation: interleaved groups detected', () => {
  const items = [
    { name: 'test1', sets: 2, groupNumber: '1' },
    { name: 'test2', sets: 2, groupNumber: '1' },
    { name: 'group2_item1', sets: 2, groupNumber: '2' }, // Group 2 in middle of Group 1
    { name: 'test3', sets: 2, groupNumber: '1' },
    { name: 'group2_item2', sets: 2, groupNumber: '2' },
  ];
  const result = validateGroupConfiguration(items);
  assert.strictEqual(result.isValid, false);
  // Both group 1 and group 2 will be flagged as interleaved
  assert.strictEqual(result.issues.length, 2);
  const groupIds = result.issues.map((i) => i.groupId).sort();
  assert.deepStrictEqual(groupIds, ['1', '2']);
  assert(result.issues.some((i) => i.message.includes('interleaved')));
});

test('group validation: multiple interleaved groups detected', () => {
  const items = [
    { name: 'test1', sets: 2, groupNumber: '1' },
    { name: 'group2_item1', sets: 2, groupNumber: '2' },
    { name: 'test2', sets: 2, groupNumber: '1' },
    { name: 'group3_item1', sets: 2, groupNumber: '3' },
    { name: 'test3', sets: 2, groupNumber: '1' },
    { name: 'group2_item2', sets: 2, groupNumber: '2' },
  ];
  const result = validateGroupConfiguration(items);
  assert.strictEqual(result.isValid, false);
  // Groups 1, 2, and 3 will all have interleaving issues
  assert(result.issues.length >= 2);
  const groupIds = result.issues.map((i) => i.groupId);
  assert(groupIds.includes('1'));
});

test('group validation: format message for valid plan', () => {
  const result = validateGroupConfiguration([
    { name: 'test1', sets: 2, groupNumber: '1' },
  ]);
  const message = formatGroupValidationMessage(result);
  assert(message.includes('✓'));
  assert(message.includes('valid'));
});

test('group validation: format message for invalid plan', () => {
  const items = [
    { name: 'test1', sets: 2, groupNumber: '1' },
    { name: 'group2_item1', sets: 2, groupNumber: '2' },
    { name: 'test2', sets: 2, groupNumber: '1' },
  ];
  const result = validateGroupConfiguration(items);
  const message = formatGroupValidationMessage(result);
  assert(message.includes('⚠️'));
  assert(message.includes('Warning'));
  assert(message.includes('interleaved'));
  assert(message.includes('Group 1'));
});
