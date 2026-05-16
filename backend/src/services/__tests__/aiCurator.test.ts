import { describe, it, expect } from 'vitest';
import { parseAiResponse, parseRoleResponse } from '../aiCurator';

const VALID_JSON = JSON.stringify({
  story: 'A golden afternoon in Rome',
  selected: [
    { index: 0, role: 'hook',   reason: 'Wide square shot' },
    { index: 2, role: 'world',  reason: 'Colosseum establishes place' },
    { index: 1, role: 'life',   reason: 'Candid gelato moment' },
    { index: 4, role: 'closer', reason: 'Sunset portrait' },
  ],
  ordering: [0, 2, 1, 4],
  missing: null,
  captions: [
    { mood: 'wanderlust', text: 'Roma in an afternoon', hashtags: ['rome'] },
  ],
  notes: '',
});

describe('parseAiResponse', () => {
  it('parses a valid JSON response', () => {
    const result = parseAiResponse(VALID_JSON);
    expect(result.selected_indices).toEqual([0, 2, 1, 4]);
    expect(result.story).toBe('A golden afternoon in Rome');
    expect(result.missing).toBeNull();
    expect(result.captions).toHaveLength(1);
  });

  it('strips markdown code fences', () => {
    const fenced = '```json\n' + VALID_JSON + '\n```';
    const result = parseAiResponse(fenced);
    expect(result.selected_indices).toHaveLength(4);
  });

  it('extracts photo_roles with correct shape', () => {
    const result = parseAiResponse(VALID_JSON);
    expect(result.photo_roles).toBeDefined();
    expect(result.photo_roles![0]).toMatchObject({ index: 0, role: 'hook', reason: expect.any(String) });
  });

  it('uses selected_indices as fallback when ordering is absent', () => {
    const noOrdering = JSON.stringify({
      selected: [{ index: 3, role: 'hook', reason: 'x' }],
      story: '',
      missing: null,
      captions: [],
    });
    const result = parseAiResponse(noOrdering);
    expect(result.ordering).toEqual([3]);
  });

  it('throws when AI returns prose instead of JSON', () => {
    expect(() => parseAiResponse("I can't help with that")).toThrow(/prose instead of JSON/i);
  });

  it('throws when AI returns a JSON error object', () => {
    expect(() => parseAiResponse(JSON.stringify({ error: 'content policy violation' }))).toThrow(
      /error response/i,
    );
  });
});

describe('parseRoleResponse', () => {
  const VALID_ROLE_JSON = JSON.stringify({
    story: 'A day at the market',
    selected: [
      { index: 0, role: 'hook',   reason: 'Crowd opener' },
      { index: 1, role: 'closer', reason: 'Sunset ending' },
    ],
    ordering: [0, 1],
    missing: 'No detail shot',
  });

  it('parses roles and ordering', () => {
    const result = parseRoleResponse(VALID_ROLE_JSON, 2);
    expect(result.photo_roles).toHaveLength(2);
    expect(result.ordering).toEqual([0, 1]);
    expect(result.story).toBe('A day at the market');
    expect(result.missing).toBe('No detail shot');
  });

  it('falls back to sequential ordering when absent', () => {
    const noOrder = JSON.stringify({ selected: [], story: '', missing: null });
    const result = parseRoleResponse(noOrder, 3);
    expect(result.ordering).toEqual([0, 1, 2]);
  });

  it('throws on prose response', () => {
    expect(() => parseRoleResponse('Sorry, I cannot do this.', 2)).toThrow(/prose instead of JSON/i);
  });
});
