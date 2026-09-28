import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('app shell', () => {
  it('renders a heading without game UI', () => {
    expect(renderToStaticMarkup(<App />)).toContain('<h1>Word practice</h1>');
  });
});
