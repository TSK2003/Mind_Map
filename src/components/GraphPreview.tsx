import { GitBranch, Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { useBrainStore } from '../store/useBrainStore';

export function GraphPreview() {
  const vault = useBrainStore((state) => state.vault);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const nodes = useMemo(
    () =>
      vault.pages.map((page, index) => ({
        ...page,
        x: 160 + Math.cos(index * 2.2) * 180,
        y: 190 + Math.sin(index * 2.2) * 120,
      })),
    [vault.pages],
  );

  return (
    <div className="graph-pane">
      <div className="graph-heading">
        <div>
          <span className="eyebrow">Knowledge graph</span>
          <h2>{vault.relationships.length} relationships</h2>
        </div>
        <div className="graph-stat">
          <GitBranch size={18} />
          <span>{vault.pages.length} notes</span>
        </div>
      </div>
      <svg className="knowledge-graph" viewBox="0 0 640 420" role="img" aria-label="Connected knowledge graph">
        {vault.relationships.map((relationship) => {
          const source = nodes.find((node) => node.id === relationship.sourceId);
          const target = nodes.find((node) => node.id === relationship.targetId);
          if (!source || !target) {
            return null;
          }

          return <line key={relationship.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
        })}
        {nodes.map((node, index) => (
          <g key={node.id} className="graph-node" onClick={() => setSelectedPage(node.id)}>
            <circle cx={node.x} cy={node.y} r={index === 0 ? 46 : 34} />
            <text x={node.x} y={node.y + 5} textAnchor="middle">
              {node.title.split(' ')[0]}
            </text>
          </g>
        ))}
      </svg>
      <div className="relationship-list">
        {vault.relationships.map((relationship) => {
          const source = vault.pages.find((page) => page.id === relationship.sourceId);
          const target = vault.pages.find((page) => page.id === relationship.targetId);

          return (
            <div className="relationship-row" key={relationship.id}>
              <Link2 size={16} />
              <span>{source?.title}</span>
              <strong>{relationship.type}</strong>
              <span>{target?.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
