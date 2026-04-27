import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pageToEditorHtml } from '../../services/editorContent';
import { useBrainStore } from '../../store/useBrainStore';

export function NotesWorkspace() {
  const pages = useBrainStore((s) => s.vault.pages);
  const selectedPageId = useBrainStore((s) => s.selectedPageId);
  const setSelectedPage = useBrainStore((s) => s.setSelectedPage);
  const createPage = useBrainStore((s) => s.createPage);
  const deletePage = useBrainStore((s) => s.deletePage);
  const openCommandPalette = useBrainStore((s) => s.openCommandPalette);
  const updateSelectedPageContent = useBrainStore((s) => s.updateSelectedPageContent);
  const updatePageMeta = useBrainStore((s) => s.updatePageMeta);
  const [query, setQuery] = useState('');

  const filteredPages = useMemo(
    () => pages.filter((p) => `${p.title} ${p.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),
    [pages, query],
  );

  const selectedPage = useMemo(() => pages.find((p) => p.id === selectedPageId) ?? pages[0], [pages, selectedPageId]);
  const content = useMemo(() => (selectedPage ? pageToEditorHtml(selectedPage) : ''), [selectedPage]);
  const canDeletePage = pages.length > 1;
  const persistTimeoutRef = useRef<number | null>(null);

  function schedulePersist(html: string) {
    if (persistTimeoutRef.current) window.clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = window.setTimeout(() => {
      updateSelectedPageContent(html);
      persistTimeoutRef.current = null;
    }, 250);
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: { attributes: { class: 'rich-editor-surface' } },
    onUpdate: ({ editor: e }) => schedulePersist(e.getHTML()),
    onBlur: ({ editor: e }) => schedulePersist(e.getHTML()),
  });

  useEffect(() => {
    return () => { if (persistTimeoutRef.current) window.clearTimeout(persistTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content);
  }, [content, editor]);

  if (!selectedPage) return null;

  return (
    <div className="notes-layout">
      <aside className="notes-list">
        <div className="panel-header">
          <span>Pages</span>
          <div className="mini-actions">
            <button type="button" title="Search" aria-label="Search pages" onClick={openCommandPalette}>
              <Search size={14} />
            </button>
            <button type="button" title="New page" aria-label="New page" onClick={() => createPage('New Page', 'Start writing your idea here.', ['inbox'])}>
              <Plus size={14} />
            </button>
            <button type="button" title={canDeletePage ? 'Delete page' : 'At least one page required'} aria-label="Delete page" disabled={!canDeletePage} onClick={() => deletePage(selectedPage.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <label className="notes-search">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages" />
        </label>
        <div className="page-stack">
          {filteredPages.map((page) => (
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
          <div className="document-meta-copy">
            <span className="eyebrow">Personal wiki</span>
            <input
              className="document-title-input"
              type="text"
              value={selectedPage.title}
              onChange={(e) => updatePageMeta(selectedPage.id, { title: e.target.value })}
              aria-label="Page title"
            />
          </div>
          <div className="document-meta-actions">
            <div className="tag-row">
              {selectedPage.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <button type="button" className="page-delete-button" disabled={!canDeletePage} onClick={() => deletePage(selectedPage.id)}>
              <Trash2 size={14} />
              <span>Delete note</span>
            </button>
          </div>
        </div>
        <div className="editor-toolbar" aria-label="Editor tools">
          <button type="button" title="Heading" aria-label="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={16} />
          </button>
          <button type="button" title="Bold" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={16} />
          </button>
          <button type="button" title="Italic" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={16} />
          </button>
        </div>
        <EditorContent editor={editor} />
      </section>
    </div>
  );
}
