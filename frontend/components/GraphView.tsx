"use client";
import { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface Props {
  nodes: Node[];
  edges: Edge[];
}

export default function GraphView({ nodes: initNodes, edges: initEdges }: Props) {
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  const nodeStyle = {
    background: "#181c24",
    border: "1px solid #2a3040",
    color: "#e8eaf0",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "12px",
    borderRadius: "6px",
    padding: "8px 12px",
  };

  const styledNodes = nodes.map(n => ({
    ...n,
    style: nodeStyle,
  }));

  const styledEdges = edges.map(e => ({
    ...e,
    style: { stroke: "#2a3040", strokeWidth: 1.5 },
    markerEnd: { type: "arrowclosed" as const, color: "#4ade80", width: 12, height: 12 },
  }));

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0b0d" }}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#1e2330" variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls style={{ background: "#111318", border: "1px solid #1e2330", borderRadius: 6 }} />
        <MiniMap
          style={{ background: "#111318", border: "1px solid #1e2330" }}
          nodeColor="#2a3040"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
      {nodes.length === 0 && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#4a5568", textAlign: "center", fontSize: "0.85rem" }}>
          <p>No import relationships detected.</p>
          <p style={{ fontSize: "0.75rem" }}>This may occur if the repository uses non-standard import patterns.</p>
        </div>
      )}
    </div>
  );
}
