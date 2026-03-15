export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const convertNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    const children = Array.from(node.childNodes).map(convertNode).join('');

    switch ((node as HTMLElement).tagName) {
      case 'H1': return `\n# ${children}\n`;
      case 'H2': return `\n## ${children}\n`;
      case 'P': return `\n${children}\n`;
      case 'STRONG':
      case 'B': return `**${children}**`;
      case 'EM':
      case 'I': return `*${children}*`;
      case 'U': return `<u>${children}</u>`;
      case 'UL': return `\n${children}\n`;
      case 'OL': return `\n${children}\n`;
      case 'LI': {
        const parent = node.parentNode as HTMLElement;
        const element = node as HTMLElement;
        const isTaskList = parent && parent.getAttribute('data-type') === 'taskList';
        const isOrdered = parent && parent.tagName === 'OL';

        if (isTaskList) {
          const isChecked = element.getAttribute('data-checked') === 'true';
          return `- [${isChecked ? 'x' : ' '}] ${children}\n`;
        }
        if (isOrdered) {
          const index = Array.from(parent.children).indexOf(node as Element) + 1;
          return `${index}. ${children}\n`;
        }
        return `* ${children}\n`;
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
