import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('app shell', () => {
  it('renders the initial loading state and shared header', () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain('Word practice</h1>');
    expect(markup).toContain('Loading word lists');
  });
});
