import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { researchRequestSchema } from '../src/schemas/research.schema.js';

describe('Research Request Schema Validation Test Suite', () => {
  it('accepts array of subreddits correctly', () => {
    const payload = {
      subreddits: ['worldnews', 'indonesia', 'technology'],
      maxTrends: 10,
      language: 'id',
    };
    const parsed = researchRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data.subreddits, ['worldnews', 'indonesia', 'technology']);
      assert.equal(parsed.data.maxTrends, 10);
    }
  });

  it('accepts comma-separated subreddits string correctly', () => {
    const payload = {
      subreddits: 'worldnews, indonesia, technology',
      max_trends: 5,
    };
    const parsed = researchRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data.subreddits, ['worldnews', 'indonesia', 'technology']);
      assert.equal(parsed.data.max_trends, 5);
    }
  });

  it('accepts bare payload defaults', () => {
    const parsed = researchRequestSchema.safeParse({});
    assert.equal(parsed.success, true);
  });
});
