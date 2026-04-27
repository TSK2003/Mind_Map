import type { KnowledgePage, PageBlock } from '../domain/types';

function blockToHtml(block: PageBlock) {
  if (block.type === 'heading') {
    return `<h2>${block.content}</h2>`;
  }

  if (block.type === 'todo') {
    return `<ul data-type="taskList"><li data-type="taskItem" data-checked="${Boolean(block.checked)}"><p>${block.content}</p></li></ul>`;
  }

  if (block.type === 'quote') {
    return `<blockquote>${block.content}</blockquote>`;
  }

  if (block.type === 'callout') {
    return `<blockquote>${block.content}</blockquote>`;
  }

  return `<p>${block.content}</p>`;
}

export function pageToEditorHtml(page: KnowledgePage) {
  const storedEditorHtml = page.metadata?.editorHtml;
  if (typeof storedEditorHtml === 'string' && storedEditorHtml.trim()) {
    return storedEditorHtml;
  }

  return page.blocks.map(blockToHtml).join('');
}

function textContentFromElement(element: Element) {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function editorHtmlToBlocks(html: string, fallbackTitle = 'Untitled'): PageBlock[] {
  if (typeof document === 'undefined') {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return [
      {
        id: `${fallbackTitle}-body`,
        type: 'paragraph',
        content: text || fallbackTitle,
      },
    ];
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  const blocks: PageBlock[] = [];

  Array.from(container.children).forEach((element, index) => {
    const content = textContentFromElement(element);

    if (!content) {
      return;
    }

    if (/^H[1-6]$/.test(element.tagName)) {
      blocks.push({
        id: `block-heading-${index}`,
        type: 'heading',
        content,
      });
      return;
    }

    if (element.tagName === 'BLOCKQUOTE') {
      blocks.push({
        id: `block-quote-${index}`,
        type: 'quote',
        content,
      });
      return;
    }

    if (element.tagName === 'UL' && element.getAttribute('data-type') === 'taskList') {
      const items = Array.from(element.querySelectorAll('li[data-type="taskItem"]'));
      items.forEach((item, taskIndex) => {
        const taskContent = textContentFromElement(item);
        if (!taskContent) {
          return;
        }

        blocks.push({
          id: `block-todo-${index}-${taskIndex}`,
          type: 'todo',
          content: taskContent,
          checked: item.getAttribute('data-checked') === 'true',
        });
      });
      return;
    }

    blocks.push({
      id: `block-paragraph-${index}`,
      type: 'paragraph',
      content,
    });
  });

  return blocks.length > 0
    ? blocks
    : [
        {
          id: `${fallbackTitle}-body`,
          type: 'paragraph',
          content: fallbackTitle,
        },
      ];
}

export function replaceEditorHtmlTitle(html: string, title: string) {
  const safeTitle = title.trim() || 'Untitled';

  if (typeof document === 'undefined') {
    if (/<h[1-6][^>]*>.*?<\/h[1-6]>/i.test(html)) {
      return html.replace(/<h([1-6])[^>]*>.*?<\/h\1>/i, `<h2>${safeTitle}</h2>`);
    }

    return `<h2>${safeTitle}</h2>${html}`;
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  const firstHeading = container.querySelector('h1, h2, h3, h4, h5, h6');

  if (firstHeading) {
    firstHeading.textContent = safeTitle;
    return container.innerHTML;
  }

  const heading = document.createElement('h2');
  heading.textContent = safeTitle;
  container.prepend(heading);
  return container.innerHTML;
}
