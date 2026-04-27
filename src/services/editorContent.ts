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
  return page.blocks.map(blockToHtml).join('');
}

