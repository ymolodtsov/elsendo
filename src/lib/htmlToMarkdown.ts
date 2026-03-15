export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const isInsideTag = (node: Node, tagName: string): boolean => {
    let parent = node.parentNode;
    while (parent) {
      if ((parent as HTMLElement).tagName === tagName) return true;
      parent = parent.parentNode;
    }
    return false;
  };

  const convertNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    const el = node as HTMLElement;
    const children = Array.from(node.childNodes).map(convertNode).join('');

    switch (el.tagName) {
      case 'H1': return `\n# ${stripInlineFormatting(children)}\n`;
      case 'H2': return `\n## ${stripInlineFormatting(children)}\n`;
      case 'P': {
        if (isInsideTag(node, 'LI')) {
          // Multiple paragraphs in a list item: separate with newline + indent
          const prevSibling = node.previousSibling as HTMLElement | null;
          if (prevSibling && prevSibling.tagName === 'P') return '\n  ' + children;
          return children;
        }
        return `\n${children}\n`;
      }
      case 'STRONG':
      case 'B': {
        if (isInsideTag(node, 'H1') || isInsideTag(node, 'H2')) return children;
        return `**${children}**`;
      }
      case 'EM':
      case 'I': {
        if (isInsideTag(node, 'H1') || isInsideTag(node, 'H2')) return children;
        return `*${children}*`;
      }
      case 'S':
      case 'DEL': return `~~${children}~~`;
      case 'U': return `<u>${children}</u>`;
      case 'CODE': {
        // Inline code (not inside a <pre>)
        if (!isInsideTag(node, 'PRE')) return `\`${children}\``;
        return children;
      }
      case 'PRE': {
        const code = el.querySelector('code');
        const text = code ? code.textContent || '' : children;
        return `\n\`\`\`\n${text}\n\`\`\`\n`;
      }
      case 'BLOCKQUOTE': {
        const lines = children.trim().split('\n');
        return '\n' + lines.map(line => `> ${line}`).join('\n') + '\n';
      }
      case 'HR': return '\n---\n';
      case 'UL': return `\n${children}\n`;
      case 'OL': return `\n${children}\n`;
      case 'LI': {
        const parent = node.parentNode as HTMLElement;
        const isTaskList = parent && parent.getAttribute('data-type') === 'taskList';
        const isOrdered = parent && parent.tagName === 'OL';

        if (isTaskList) {
          const isChecked = el.getAttribute('data-checked') === 'true';
          return `- [${isChecked ? 'x' : ' '}] ${children.trim()}\n`;
        }
        if (isOrdered) {
          const index = Array.from(parent.children).indexOf(el) + 1;
          return `${index}. ${children.trim()}\n`;
        }
        return `* ${children.trim()}\n`;
      }
      case 'A': return `[${children}](${(node as HTMLAnchorElement).getAttribute('href')})`;
      case 'BR': return '\n';
      default: return children;
    }
  };

  let markdown = convertNode(doc.body).trim();
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  return markdown;
}

/** Strip bold/italic Markdown markers (for use inside headings) */
function stripInlineFormatting(text: string): string {
  return text.replace(/\*{1,2}(.+?)\*{1,2}/g, '$1');
}
