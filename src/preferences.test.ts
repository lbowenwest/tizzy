import { describe, expect, it } from 'vitest';
import { defaults, parsePreferences } from './preferences';

describe('preferences', () => {
  it('recovers from missing, corrupt and invalid storage', () => {
    for (const input of [null, '{', 'true', '{}', '{"theme":"unknown","rules":{}}', '{"theme":"club","rules":{"length":99}}']) {
      expect(parsePreferences(input)).toEqual(defaults);
    }
  });
  it('restores supported choices without accepting arbitrary fields', () => {
    expect(parsePreferences(JSON.stringify({ theme: 'club', rules: { format: 'sequence', length: 6, invalid: 'fail', timer: true } })))
      .toEqual({ theme: 'club', rules: { format: 'sequence', length: 6, invalid: 'fail' } });
  });
});
