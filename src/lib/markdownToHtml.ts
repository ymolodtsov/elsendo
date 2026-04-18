import { marked } from 'marked';

// Configure marked for clean HTML output matching Tiptap's schema
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Heuristic: does this plain text look like Markdown?
 * We check for common Markdown patterns that wouldn't appear in normal prose.
 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split('\n');
  let signals = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    // Headings: # Title
    if (/^#{1,6}\s/.test(trimmed)) { signals += 2; continue; }
    // Fenced code blocks
    if (/^```/.test(trimmed)) { signals += 2; continue; }
    // Blockquotes: > text
    if (/^>\s/.test(trimmed)) { signals++; continue; }
    // Unordered lists: - item or * item (but not just a dash alone)
    if (/^[-*+]\s+\S/.test(trimmed)) { signals++; continue; }
    // Ordered lists: 1. item
    if (/^\d+\.\s+\S/.test(trimmed)) { signals++; continue; }
    // Task lists: - [ ] or - [x]
    if (/^[-*]\s\[[ xX]\]\s/.test(trimmed)) { signals += 2; continue; }
    // Horizontal rules
    if (/^(---+|\*\*\*+|___+)\s*$/.test(trimmed)) { signals++; continue; }
  }

  // Inline patterns (check full text)
  // Bold: **text**
  if (/\*\*[^*]+\*\*/.test(text)) signals++;
  // Italic: *text* (but not ** which is bold)
  if (/(?<!\*)\*(?!\*)[^*]+(?<!\*)\*(?!\*)/.test(text)) signals++;
  // Links: [text](url)
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) signals += 2;
  // Images: ![alt](url)
  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) signals += 2;
  // Inline code: `code`
  if (/`[^`]+`/.test(text)) signals++;
  // Strikethrough: ~~text~~
  if (/~~[^~]+~~/.test(text)) signals++;

  // Require at least 2 signals to treat as Markdown
  return signals >= 2;
}

/**
 * Convert Markdown text to HTML suitable for Tiptap.
 * Handles task lists and cleans up output for ProseMirror compatibility.
 */
export function markdownToHtml(markdown: string): string {
  let html = marked.parse(markdown) as string;

  // Convert GFM task list items to Tiptap's task list format
  // marked outputs: <li><input checked="" disabled="" type="checkbox"> text</li>
  // Tiptap expects: <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>text</p></li></ul>
  html = html.replace(
    /<ul>\s*(<li>\s*<input[^>]*type="checkbox"[^>]*>.*?<\/li>\s*)+<\/ul>/gs,
    (match) => {
      const items = match.replace(/<ul>|<\/ul>/g, '');
      const converted = items.replace(
        /<li>\s*<input([^>]*)>\s*(.*?)\s*<\/li>/gs,
        (_m, attrs: string, content: string) => {
          const checked = attrs.includes('checked') ? 'true' : 'false';
          // Wrap content in <p> if not already wrapped
          const wrappedContent = content.startsWith('<p>') ? content : `<p>${content}</p>`;
          return `<li data-type="taskItem" data-checked="${checked}">${wrappedContent}</li>`;
        }
      );
      return `<ul data-type="taskList">${converted}</ul>`;
    }
  );

  return html.trim();
}
