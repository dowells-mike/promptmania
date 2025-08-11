import { describe, it, expect } from 'vitest';
import { htmlToMarkdownLite } from '../state';

describe('htmlToMarkdownLite', () => {
  it('converts basic formatting', () => {
    expect(htmlToMarkdownLite('<strong>Bold</strong>')).toBe('**Bold**');
    expect(htmlToMarkdownLite('<b>Bold</b>')).toBe('**Bold**');
    expect(htmlToMarkdownLite('<em>Ital</em>')).toBe('*Ital*');
    expect(htmlToMarkdownLite('<i>Ital</i>')).toBe('*Ital*');
    expect(htmlToMarkdownLite('<u>Under</u>')).toBe('_Under_');
  });
  it('handles code and escapes backticks', () => {
    expect(htmlToMarkdownLite('<code>sum()</code>')).toBe('`sum()`');
    expect(htmlToMarkdownLite('<code>`ticks`</code>').replace(/\u200b/g,'')).toBe('``ticks``');
  });
  it('handles links and headings', () => {
    expect(htmlToMarkdownLite('<a href="https://x.test">site</a>')).toBe('[site](https://x.test)');
    expect(htmlToMarkdownLite('<h2>Title</h2>')).toBe('Title');
  });
  it('strips other tags and collapses whitespace', () => {
    expect(htmlToMarkdownLite('<div> A  <span> B </span> C </div>')).toBe('A B C');
  });
});
