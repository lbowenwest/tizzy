import { describe, expect, it } from 'vitest';
import { defaults, parsePreferences } from './preferences';
import { copyRules, defaultRules } from './game';
import { getPresetKey, presets } from './presets';

describe('preferences', () => {
  it('preserves every supported guess count', () => {
    for (let maxGuesses = 1; maxGuesses <= 10; maxGuesses++) {
      const value = { theme: 'club', rules: { ...copyRules(defaultRules), maxGuesses } };
      expect(parsePreferences(JSON.stringify(value))).toEqual(value);
    }
  });
  it('preserves an explicit unlimited guess limit', () => {
    const value = { theme: 'club', rules: { ...copyRules(defaultRules), maxGuesses: null } };
    expect(parsePreferences(JSON.stringify(value))).toEqual(value);
  });
  it('rejects invalid numeric guess counts', () => {
    for (const maxGuesses of [0, -1, 11, 1.5, '6', true, 1_000_000]) {
      expect(parsePreferences(JSON.stringify({ theme: 'club', rules: { ...copyRules(defaultRules), maxGuesses } }))).toEqual(defaults);
    }
  });
  it('recovers from missing, corrupt and invalid storage', () => {
    for (const input of [null, '{', 'true', '{}', '{"theme":"unknown","rules":{}}', '{"theme":"club","rules":{"length":99}}']) {
      expect(parsePreferences(input)).toEqual(defaults);
    }
  });
  it('upgrades legacy preferences to untimed without losing their choices', () => {
    const legacy = { theme: 'club', rules: { format: 'sequence', length: 6, invalid: 'consume' } };
    expect(parsePreferences(JSON.stringify(legacy))).toEqual({
      theme: 'club', rules: { ...defaultRules, ...legacy.rules },
    });
  });
  it('upgrades previously saved timed rules to five guesses without losing timers', () => {
    const legacy = { theme: 'afterhours', rules: { format: 'sequence', length: 6, invalid: 'consume',
      wordClock: { mode: 'guess', seconds: 12 }, roundSeconds: 90 } };
    expect(parsePreferences(JSON.stringify(legacy))).toEqual({ theme: 'afterhours',
      rules: { ...legacy.rules, maxGuesses: 5 } });
  });
  it('restores supported choices without accepting arbitrary fields', () => {
    expect(parsePreferences(JSON.stringify({ theme: 'club', rules: { format: 'sequence', length: 6, invalid: 'fail', timer: true } })))
      .toEqual({ theme: 'club', rules: { ...defaultRules, format: 'sequence', length: 6, invalid: 'fail' } });
  });
  it('persists every timer mode and independent overall duration', () => {
    for (const mode of ['off', 'word', 'guess'] as const) {
      const value = { theme: 'afterhours', rules: { ...copyRules(defaultRules), format: 'sequence', wordClock: { mode, seconds: 12 }, roundSeconds: 90 } };
      expect(parsePreferences(JSON.stringify(value))).toEqual(value);
    }
  });
  it('rejects invalid timer modes, durations and shapes', () => {
    for (const wordClock of [null, {}, { mode: 'unknown', seconds: 10 }, { mode: 'guess', seconds: 0 },
      { mode: 'word', seconds: -1 }, { mode: 'word', seconds: 1.5 }, { mode: 'word', seconds: '10' }]) {
      expect(parsePreferences(JSON.stringify({ ...defaults, rules: { ...defaultRules, wordClock } }))).toEqual(defaults);
    }
    for (const roundSeconds of [0, -1, 1.5, '90', false, {}]) {
      expect(parsePreferences(JSON.stringify({ ...defaults, rules: { ...defaultRules, roundSeconds } }))).toEqual(defaults);
    }
  });
  it('returns independent nested settings for defaults and restored storage', () => {
    const value = parsePreferences(null);
    value.rules.wordClock.seconds = 123;
    expect(parsePreferences(null)).toEqual(defaults);
    expect(defaults.rules.wordClock.seconds).toBe(10);
  });
});

describe('presets', () => {
  it('defaults only the final to unlimited guesses while preserving its timer and policy', () => {
    expect(presets.find(({ key }) => key === 'final')!.rules).toMatchObject({
      maxGuesses: null, roundSeconds: 90, wordClock: { mode: 'off' }, invalid: 'consume',
    });
    for (const preset of presets.filter(({ key }) => key !== 'final')) expect(preset.rules.maxGuesses).toBe(5);
  });
  it('shares the ordinary editable configuration path and round-trips through storage', () => {
    for (const preset of presets) {
      expect(getPresetKey(preset.rules)).toBe(preset.key);
      const restored = parsePreferences(JSON.stringify({ theme: 'club', rules: preset.rules }));
      expect(restored.rules).toEqual(preset.rules);
      expect(getPresetKey(restored.rules)).toBe(preset.key);
    }
  });
  it('marks changed configurations as custom and keeps themes outside game rules', () => {
    const preset = presets.find(({ key }) => key === 'itv-five')!;
    const changed = copyRules(preset.rules);
    changed.wordClock.seconds = 20;
    expect(getPresetKey(changed)).toBe('custom');
    expect(preset.rules.wordClock.seconds).toBe(10);
    expect(getPresetKey({ ...preset.rules, maxGuesses: 6 })).toBe('custom');
  });
  it('recognises presets despite settings the format or clock ignores', () => {
    const rulesFor = (key: string) => copyRules(presets.find((entry) => entry.key === key)!.rules);
    expect(getPresetKey({ ...rulesFor('sequence'), length: 4 })).toBe('sequence');
    expect(getPresetKey({ ...rulesFor('final'), length: 6 })).toBe('final');
    expect(getPresetKey({ ...rulesFor('practice'), wordClock: { mode: 'off', seconds: 20 } })).toBe('practice');
    expect(getPresetKey({ ...rulesFor('practice'), roundSeconds: 90 })).toBe('practice');
    expect(getPresetKey({ ...rulesFor('practice'), length: 4 })).toBe('custom');
    expect(getPresetKey({ ...rulesFor('sequence'), roundSeconds: 90 })).toBe('custom');
  });
});
