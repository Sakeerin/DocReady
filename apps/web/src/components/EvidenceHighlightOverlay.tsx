import React from 'react';
import { BoundingBox } from '@docready/contracts';

interface EvidenceHighlightOverlayProps {
  boundingBoxes: Array<{
    id: string;
    label: string;
    box: BoundingBox;
    isActive?: boolean;
  }>;
  imageWidth: number;
  imageHeight: number;
}

export function EvidenceHighlightOverlay({
  boundingBoxes,
  imageWidth,
  imageHeight,
}: EvidenceHighlightOverlayProps) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        pointerEvents: 'none',
      }}
    >
      {boundingBoxes.map((item) => {
        const left = item.box.x * imageWidth;
        const top = item.box.y * imageHeight;
        const width = item.box.width * imageWidth;
        const height = item.box.height * imageHeight;
        const strokeColor = item.isActive ? '#0284c7' : '#eab308';
        const fillColor = item.isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(234, 179, 8, 0.15)';

        return (
          <g key={item.id}>
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={item.isActive ? 3 : 2}
              rx={3}
            />
            {item.isActive && (
              <text
                x={left}
                y={Math.max(top - 4, 12)}
                fill="#0369a1"
                fontSize="11px"
                fontWeight="bold"
              >
                {item.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
