import { describe, expect, it } from 'vitest';
import { defaults, parsePreferences } from './preferences';
import { copyRules, defaultRules } from './game';
import { describeRules, getPresetKey, presetRules, presets } from './presets';

describe('preferences', () => {
  it('round-trips every preset and theme', () => {
    for (const { key } of presets) {
      const value = { theme: 'club', preset: key };
      expect(parsePreferences(JSON.stringify(value))).toEqual(value);
    }
  });
  it('recovers from missing, corrupt and invalid storage', () => {
    for (const input of [null, '{', 'true', '{}', '{"theme":"unknown","preset":"practice"}', '{"theme":"club","preset":"custom"}']) {
      expect(parsePreferences(input).preset).toBe(defaults.preset);
    }
    expect(parsePreferences('{"theme":"unknown","preset":"final"}')).toEqual({ theme: 'letterpress', preset: 'final' });
  });
  it('maps rules saved before presets-only to the preset they match', () => {
    const saved = (rules: object) => parsePreferences(JSON.stringify({ theme: 'afterhours', rules })).preset;
    for (const preset of presets) expect(saved(preset.rules)).toBe(preset.key);
    // Fields added since default as they did then: untimed, five guesses, no clue.
    expect(saved({ format: 'single', length: 4, invalid: 'reject' })).toBe('practice-four');
    expect(saved({ format: 'single', length: 5, invalid: 'fail', wordClock: { mode: 'guess', seconds: 10 } })).toBe('itv-five');
    expect(parsePreferences(JSON.stringify({ theme: 'afterhours', rules: { length: 6 } }))).toEqual({ theme: 'afterhours', preset: 'practice-six' });
  });
  it('falls back to Practice for custom or malformed saved rules', () => {
    const saved = (rules: unknown) => parsePreferences(JSON.stringify({ theme: 'club', rules })).preset;
    expect(saved({ ...defaultRules, maxGuesses: 3 })).toBe('practice');
    expect(saved({ format: 'sequence', length: 6, invalid: 'consume' })).toBe('practice');
    expect(saved({ ...defaultRules, wordClock: { mode: 'word', seconds: 12 } })).toBe('practice');
    for (const rules of [null, 'x', { wordClock: null }, { length: 99 }]) expect(saved(rules)).toBe('practice');
  });
});

describe('presets', () => {
  it('defaults only the final to unlimited guesses while preserving its timer and policy', () => {
    expect(presets.find(({ key }) => key === 'final')!.rules).toMatchObject({
      maxGuesses: null, roundSeconds: 90, wordClock: { mode: 'off' }, invalid: 'consume',
    });
    for (const preset of presets.filter(({ key }) => key !== 'final' && key !== 'in-one')) {
      expect(preset.rules).toMatchObject({ maxGuesses: 5, clue: false });
    }
  });
  it('makes In one an untimed five-letter clue puzzle with one try', () => {
    const inOne = presets.find(({ key }) => key === 'in-one')!;
    expect(inOne.rules).toEqual({ ...defaultRules, maxGuesses: 1, clue: true });
    expect(describeRules(inOne.rules)).toBe('5 letters · Starts with a clue only the answer fits; no first letter · 1 guess per word · Untimed · Unknown words are free to reject');
  });
  it('offers untimed practice at every length, then the sequence and timed presets', () => {
    expect(presets.map(({ key }) => key)).toEqual(['practice-four', 'practice', 'practice-six', 'sequence', 'itv-four', 'itv-five', 'final', 'in-one']);
    for (const length of [4, 5, 6] as const) {
      expect(presets.find(({ rules }) => rules.format === 'single' && !rules.clue && rules.wordClock.mode === 'off' && rules.length === length)!.rules)
        .toEqual({ ...defaultRules, length });
    }
  });
  it('identify their own rules and hand out independent copies', () => {
    for (const preset of presets) expect(getPresetKey(preset.rules)).toBe(preset.key);
    const copy = presetRules('itv-five');
    copy.wordClock.seconds = 20;
    expect(presetRules('itv-five').wordClock.seconds).toBe(10);
    expect(presetRules('retired')).toEqual(presetRules('practice'));
  });
  it('match no preset for changed configurations', () => {
    const preset = presets.find(({ key }) => key === 'itv-five')!;
    const changed = copyRules(preset.rules);
    changed.wordClock.seconds = 20;
    expect(getPresetKey(changed)).toBeNull();
    expect(preset.rules.wordClock.seconds).toBe(10);
    expect(getPresetKey({ ...preset.rules, maxGuesses: 6 })).toBeNull();
  });
  it('recognises presets despite settings the format or clock ignores', () => {
    const rulesFor = (key: string) => copyRules(presets.find((entry) => entry.key === key)!.rules);
    expect(getPresetKey({ ...rulesFor('sequence'), length: 4 })).toBe('sequence');
    expect(getPresetKey({ ...rulesFor('final'), length: 6 })).toBe('final');
    expect(getPresetKey({ ...rulesFor('practice'), wordClock: { mode: 'off', seconds: 20 } })).toBe('practice');
    expect(getPresetKey({ ...rulesFor('practice'), roundSeconds: 90 })).toBe('practice');
    expect(getPresetKey({ ...rulesFor('practice'), length: 4 })).toBe('practice-four');
    expect(getPresetKey({ ...rulesFor('sequence'), roundSeconds: 90 })).toBeNull();
    expect(getPresetKey({ ...rulesFor('sequence'), clue: true })).toBe('sequence');
    expect(describeRules({ ...rulesFor('sequence'), clue: true })).toBe(describeRules(rulesFor('sequence')));
    expect(getPresetKey({ ...rulesFor('practice'), clue: true })).toBeNull();
  });
});
