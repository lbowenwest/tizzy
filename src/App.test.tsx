import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('app shell', () => {
  it('renders the initial loading state without game UI', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('<h1>Word practice</h1>');
    expect(markup).toContain('Loading word lists');
  });
});
