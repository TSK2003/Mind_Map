import { ChevronRight, FileText, Image, Link2, Minus, Paperclip, Plus, Unlink, Waypoints, X } from 'lucide-react';
import type { MindMapNode } from '../../domain/types';

export function BrainNodeCard({
  node,
  isSelected,
  isPendingConnection,
  childCount,
  hasParentEdge,
  onPointerDown,
  onSelect,
  onOpenNote,
  onCreateNote,
  onAddChild,
  onStartConnection,
  onToggleCollapse,
  onAttachFile,
  onDeleteAttachment,
  onDisconnectFromParent,
}: {
  node: MindMapNode;
  isSelected: boolean;
  isPendingConnection: boolean;
  childCount: number;
  hasParentEdge: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onOpenNote: () => void;
  onCreateNote: () => void;
  onAddChild: () => void;
  onStartConnection: () => void;
  onToggleCollapse: () => void;
  onAttachFile: () => void;
  onDeleteAttachment: () => void;
  onDisconnectFromParent: () => void;
}) {
  const hasChildren = childCount > 0;
  const isCollapsed = Boolean(node.data.collapsed);

  return (
    <div
      className={isSelected ? 'canvas-node is-selected' : 'canvas-node'}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onDoubleClick={() => {
        if (node.data.noteId) {
          onOpenNote();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <article className={`brain-node tone-${node.data.tone}`}>
        <div className="brain-node-header">
          <span>{node.data.label}</span>
          <span className={isPendingConnection ? 'node-connection-chip is-active' : 'node-connection-chip'}>
            <Waypoints size={11} />
            <span>{isPendingConnection ? 'Pick' : 'Link'}</span>
          </span>
        </div>

        {node.data.summary ? <p>{node.data.summary}</p> : null}

        {/* Attachment preview */}
        {node.data.attachment ? (
          <div className="node-attachment-preview">
            {node.data.attachment.type === 'image' ? (
              <img src={node.data.attachment.dataUrl} alt={node.data.attachment.name} />
            ) : (
              <div className="node-attachment-file">
                <Paperclip size={12} />
                <span>{node.data.attachment.name}</span>
              </div>
            )}
            <button
              className="attachment-delete-btn"
              type="button"
              title="Remove attachment"
              onClick={(e) => { e.stopPropagation(); onDeleteAttachment(); }}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        {node.data.noteId ? (
          <div className="node-link">
            <Link2 size={11} />
            <span>Linked note</span>
          </div>
        ) : null}

        {/* Node action buttons — visible when selected */}
        {isSelected ? (
          <div className="brain-node-footer">
            <button className="brain-node-action" type="button" onClick={(e) => { e.stopPropagation(); onAddChild(); }}>
              <Plus size={12} />
              <span>Child</span>
            </button>
            <button className="brain-node-action" type="button" onClick={(e) => { e.stopPropagation(); onStartConnection(); }}>
              <Waypoints size={12} />
              <span>{isPendingConnection ? 'Cancel' : 'Link'}</span>
            </button>
            <button
              className="brain-node-action"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (node.data.noteId) {
                  onOpenNote();
                  return;
                }
                onCreateNote();
              }}
            >
              <FileText size={12} />
              <span>{node.data.noteId ? 'Note' : 'Note+'}</span>
            </button>
            <button className="brain-node-action" type="button" onClick={(e) => { e.stopPropagation(); onAttachFile(); }}>
              <Image size={12} />
              <span>Attach</span>
            </button>
            {hasParentEdge ? (
              <button className="brain-node-action is-danger" type="button" onClick={(e) => { e.stopPropagation(); onDisconnectFromParent(); }}>
                <Unlink size={12} />
                <span>Unlink</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* +/- Expand/Collapse button on the right edge */}
        {hasChildren ? (
          <button
            className="node-expand-collapse"
            type="button"
            title={isCollapsed ? `Expand (${childCount} children)` : `Collapse (${childCount} children)`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <Minus size={12} />}
            {isCollapsed ? (
              <span className="child-count-badge animate-badge-pop">{childCount}</span>
            ) : null}
          </button>
        ) : (
          <button
            className="node-expand-collapse"
            type="button"
            title="Add child node"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild();
            }}
          >
            <Plus size={12} />
          </button>
        )}
      </article>
    </div>
  );
}
