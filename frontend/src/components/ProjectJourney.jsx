import React from 'react';
import { stageLabels } from '../utils/format';

// The stage path of a project: finished stages filled, current stage ringed in brass.
export function JourneyRail({ project, compact = false }) {
  const labels = stageLabels(project?.service);
  const delivered = project?.status === 'delivered' || project?.status === 'completed';
  const current = delivered ? labels.length : Math.min(Number(project?.stage || 0), labels.length - 1);

  return (
    <div
      className={`rail${compact ? ' compact' : ''}`}
      style={{ gridTemplateColumns: `repeat(${labels.length - 1}, minmax(0, 1fr)) auto` }}
      role="img"
      aria-label={delivered ? 'All stages complete' : `Stage ${current + 1} of ${labels.length}: ${labels[current]}`}
    >
      {labels.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'now' : 'next';
        return (
          <div key={label} className={`rail-stop ${state}`} title={label}>
            <span className="rail-dot" />
            <span className="rail-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
