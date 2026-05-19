import { describe, it, expect } from 'vitest';
import { buildPersonaClause, buildSystemPrompt, buildRolePrompt } from '../promptBuilder';

const PERSONAS = ['aesthete', 'social', 'logger', 'storyteller', 'mood'] as const;

describe('buildPersonaClause', () => {
  it('returns empty string for undefined persona', () => {
    expect(buildPersonaClause(undefined, 10)).toBe('');
  });

  it('returns empty string for unknown persona key', () => {
    expect(buildPersonaClause('unknown_persona', 10)).toBe('');
  });

  it('injects correct key phrase for each known persona', () => {
    const expectations: Record<typeof PERSONAS[number], string> = {
      aesthete:    'palette',
      social:      'Tag me in that one',
      logger:      'documentary instinct',
      storyteller: 'sequences',
      mood:        'light is right',
    };
    for (const [persona, keyword] of Object.entries(expectations)) {
      const clause = buildPersonaClause(persona, 10);
      expect(clause).toContain(keyword);
    }
  });

  it('includes the persona heading for each persona', () => {
    for (const persona of PERSONAS) {
      const clause = buildPersonaClause(persona, 10);
      expect(clause).toContain(persona.toUpperCase());
    }
  });
});

describe('buildSystemPrompt', () => {
  it('mentions the photo count', () => {
    const prompt = buildSystemPrompt(25, 10, undefined, undefined, undefined);
    expect(prompt).toContain('25');
  });

  it('injects vibe when provided', () => {
    const prompt = buildSystemPrompt(10, 10, 'golden hour in Bali', undefined, undefined);
    expect(prompt).toContain('golden hour in Bali');
  });

  it('does not inject vibe when not provided', () => {
    const prompt = buildSystemPrompt(10, 10, undefined, undefined, undefined);
    expect(prompt).not.toContain('user\'s requested vibe');
  });

  it('injects persona clause when persona is set', () => {
    for (const persona of PERSONAS) {
      const prompt = buildSystemPrompt(10, 10, undefined, undefined, undefined, undefined, persona);
      expect(prompt).toContain(persona.toUpperCase());
    }
  });

  it('suppresses content-mix clause when persona is set', () => {
    const prompt = buildSystemPrompt(10, 10, undefined, undefined, undefined, 'people', 'aesthete');
    expect(prompt).not.toContain('CONTENT MIX');
  });

  it('shows content-mix clause when no persona is set', () => {
    const prompt = buildSystemPrompt(10, 10, undefined, undefined, undefined, 'people', undefined);
    expect(prompt).toContain('CONTENT MIX');
  });

  it('includes favorite indices when provided', () => {
    const prompt = buildSystemPrompt(10, 10, undefined, undefined, [2, 5]);
    expect(prompt).toContain('2, 5');
    expect(prompt).toContain('heart-favorited');
  });

  it('always ends with a JSON schema example', () => {
    const prompt = buildSystemPrompt(10, 10, undefined, undefined, undefined);
    expect(prompt).toContain('"story"');
    expect(prompt).toContain('"selected"');
    expect(prompt).toContain('"ordering"');
    expect(prompt).toContain('"captions"');
  });
});

describe('buildRolePrompt', () => {
  it('mentions the photo count', () => {
    const prompt = buildRolePrompt(7);
    expect(prompt).toContain('7');
  });

  it('injects vibe when provided', () => {
    const prompt = buildRolePrompt(5, 'sunset road trip');
    expect(prompt).toContain('sunset road trip');
  });

  it('includes all role beats', () => {
    const prompt = buildRolePrompt(5);
    expect(prompt).toContain('HOOK');
    expect(prompt).toContain('WORLD');
    expect(prompt).toContain('LIFE');
    expect(prompt).toContain('DETAIL');
    expect(prompt).toContain('CLOSER');
  });

  it('injects persona clause when provided', () => {
    const prompt = buildRolePrompt(5, undefined, undefined, 'mood');
    expect(prompt).toContain('MOOD');
  });
});
