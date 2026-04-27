import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, Link2, ListTodo, Plus, Search } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { pageToEditorHtml } from '../services/editorContent';
import { useBrainStore } from '../store/useBrainStore';

export function NotesWorkspace() {
  const pages = useBrainStore((state) => state.vault.pages);
  const selectedPageId = useBrainStore((state) => state.selectedPageId);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const createPage = useBrainStore((state) => state.createPage);
  const openCommandPalette = useBrainStore((state) => state.openCommandPalette);
  const updateSelectedPageContent = useBrainStore((state) => state.updateSelectedPageContent);
  const selectedPage = useMemo(() => pages.find((page) => page.id === selectedPageId) ?? pages[0], [pages, selectedPageId]);
  const content = useMemo(() => (selectedPage ? pageToEditorHtml(selectedPage) : ''), [selectedPage]);

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class: 'rich-editor-surface',
      },
    },
    onBlur: ({ editor: currentEditor }) => {
      updateSelectedPageContent(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!selectedPage) {
    return null;
  }

  return (
    <div className="notes-layout">
      <aside className="notes-list">
        <div className="panel-header">
          <span>Pages</span>
          <div className="mini-actions">
            <button type="button" title="Search pages" aria-label="Search pages" onClick={openCommandPalette}>
              <Search size={15} />
            </button>
            <button type="button" title="New page" aria-label="New page" onClick={() => createPage('New Page', 'Start writing your idea here.', ['inbox'])}>
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div className="page-stack">
          {pages.map((page) => (
            <button
              className={page.id === selectedPage.id ? 'page-row is-selected' : 'page-row'}
              key={page.id}
              type="button"
              onClick={() => setSelectedPage(page.id)}
            >
              <span className="page-icon">{page.icon.slice(0, 1)}</span>
              <span>{page.title}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="editor-pane">
        <div className="document-meta">
          <div>
            <span className="eyebrow">Personal wiki</span>
            <h2>{selectedPage.title}</h2>
          </div>
          <div className="tag-row">
            {selectedPage.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="editor-toolbar" aria-label="Editor tools">
          <button type="button" title="Heading" aria-label="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={17} />
          </button>
          <button type="button" title="Bold" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={17} />
          </button>
          <button type="button" title="Italic" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={17} />
          </button>
          <button type="button" title="Task list" aria-label="Task list" onClick={() => editor?.chain().focus().insertContent('<p>[ ] New task</p>').run()}>
            <ListTodo size={17} />
          </button>
          <button type="button" title="Link note" aria-label="Link note" onClick={() => editor?.chain().focus().insertContent('[[Linked note]]').run()}>
            <Link2 size={17} />
          </button>
        </div>
        <EditorContent editor={editor} />
      </section>
    </div>
  );
}
