import {
  type Edge,
  type EdgeProps,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react'

interface AssociationEdgeData {
  label?: string
  color?: string
  [key: string]: unknown
}

type AssociationEdgeType = Edge<AssociationEdgeData>

export function AssociationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<AssociationEdgeType>) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  const color = data?.color ?? '#8b5cf6'
  const label = data?.label

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }}
      />
      {/* Animated dash overlay */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 4"
        className="animate-[dash_1s_linear_infinite]"
        style={{
          animation: 'dash 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              fontWeight: 600,
              background: color,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 9999,
              whiteSpace: 'nowrap',
              opacity: 0.95,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

