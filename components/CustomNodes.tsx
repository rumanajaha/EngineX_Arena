"use client";

import React, { useState, useEffect } from "react";
import { Handle, Position } from "reactflow";

export interface CustomNodeData {
  name?: string;
  label?: string;
  color?: string;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}

export interface CustomNodeProps {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}

// Map types to premium colors and icon identifiers
export const NODE_CONFIGS: Record<string, { color: string; label: string; icon: string }> = {
  Client: { color: "#3B82F6", label: "Client", icon: "client" },
  Server: { color: "#10B981", label: "Server", icon: "server" },
  Database: { color: "#059669", label: "Database", icon: "database" },
  Cache: { color: "#F59E0B", label: "Cache", icon: "cache" },
  Queue: { color: "#8B5CF6", label: "Queue", icon: "queue" },
  CDN: { color: "#06B6D4", label: "CDN", icon: "cdn" },
  "Load Balancer": { color: "#F97316", label: "Load Balancer", icon: "balancer" },
  "API Gateway": { color: "#6366F1", label: "API Gateway", icon: "gateway" },
  "Message Broker": { color: "#EC4899", label: "Message Broker", icon: "broker" },
};

const normalizeType = (type: string) => {
  if (!type) return "Server";
  const t = type.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "client") return "Client";
  if (t === "server") return "Server";
  if (t === "database" || t === "db") return "Database";
  if (t === "cache") return "Cache";
  if (t === "queue") return "Queue";
  if (t === "cdn") return "CDN";
  if (t === "loadbalancer" || t === "balancer") return "Load Balancer";
  if (t === "apigateway" || t === "gateway") return "API Gateway";
  if (t === "messagebroker" || t === "broker") return "Message Broker";
  return "Server"; // fallback
};

const getIconSvg = (iconName: string, color: string) => {
  switch (iconName) {
    case "client":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "server":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      );
    case "database":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      );
    case "cache":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "queue":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "cdn":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      );
    case "balancer":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4" />
        </svg>
      );
    case "gateway":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "broker":
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
  }
};

export function ArchNode({ id, data, selected }: CustomNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.name || data.label || "");

  useEffect(() => {
    setName(data.name || data.label || "");
  }, [data.name, data.label]);

  const typeName = normalizeType(data.label || "Server");
  const config = NODE_CONFIGS[typeName] || NODE_CONFIGS.Server;
  const color = data.color || config.color;

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onRename) {
      data.onRename(id, name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  return (
    <div
      className={`relative rounded-xl border p-3.5 min-w-[155px] bg-[#161612] text-cream shadow-xl group transition-all duration-200 ${
        selected ? "ring-1 ring-sand border-sand" : "border-khaki/20 hover:border-khaki/40"
      }`}
      style={{
        boxShadow: selected ? `0 0 15px ${color}1A` : undefined,
      }}
    >
      {/* Node Type Top bar */}
      <div className="flex items-center space-x-1.5 mb-2.5">
        <div
          className="w-5 h-5 rounded flex items-center justify-center border border-white/5 shadow-inner"
          style={{ backgroundColor: `${color}15` }}
        >
          {getIconSvg(config.icon, color)}
        </div>
        <span
          className="font-space text-[8px] font-black uppercase tracking-widest"
          style={{ color }}
        >
          {config.label}
        </span>
      </div>

      {/* Editable Name display */}
      <div className="text-center py-1">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-bg border border-sand/30 text-cream px-1.5 py-0.5 rounded text-[11px] font-mono focus:outline-none w-full text-center"
            autoFocus
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="font-mono text-xs font-bold text-cream select-none cursor-text truncate max-w-[135px] border border-transparent hover:border-khaki/10 px-1 py-0.5 rounded"
          >
            {name || typeName}
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="l-target"
        style={{ background: color, border: "2px solid #161612", width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="t-target"
        style={{ background: color, border: "2px solid #161612", width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r-source"
        style={{ background: color, border: "2px solid #161612", width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b-source"
        style={{ background: color, border: "2px solid #161612", width: 8, height: 8 }}
      />

      {/* Delete button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (data.onDelete) data.onDelete(id);
        }}
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer shadow-md text-[8px] font-black z-30"
      >
        ✕
      </button>
    </div>
  );
}

export function TextLabelNode({ id, data, selected }: CustomNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.name || data.label || "Text Label");

  useEffect(() => {
    setText(data.name || data.label || "Text Label");
  }, [data.name, data.label]);

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onRename) {
      data.onRename(id, text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  return (
    <div
      className={`relative px-3 py-1.5 min-w-[90px] bg-transparent text-cream shadow-none group transition-all duration-200 rounded ${
        selected ? "border border-dashed border-sand/40 bg-surface/10" : "border border-transparent hover:border-khaki/10"
      }`}
    >
      <div className="text-center">
        {isEditing ? (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-bg border border-sand/30 text-cream px-1.5 py-0.5 rounded text-[11px] font-mono focus:outline-none w-full text-center"
            autoFocus
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="font-mono text-xs text-cream select-none cursor-text truncate max-w-[130px]"
          >
            {text}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (data.onDelete) data.onDelete(id);
        }}
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer shadow-md text-[8px] font-black z-30"
      >
        ✕
      </button>
    </div>
  );
}

export function StickyNoteNode({ id, data, selected }: CustomNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.name || data.label || "Sticky Note");

  useEffect(() => {
    setText(data.name || data.label || "Sticky Note");
  }, [data.name, data.label]);

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onRename) {
      data.onRename(id, text);
    }
  };

  return (
    <div
      className={`relative p-3 min-w-[145px] min-h-[105px] bg-[#FEF08A] text-slate-800 shadow-xl group rounded-sm flex flex-col justify-between border border-[#FDE047] transition-all duration-200 ${
        selected ? "ring-2 ring-sand border-transparent" : ""
      }`}
    >
      {isEditing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          className="bg-yellow-50 border border-yellow-400 text-slate-800 p-1 text-[11px] font-sans focus:outline-none w-full h-[75px] resize-none leading-relaxed"
          autoFocus
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className="font-sans text-[11px] leading-snug text-slate-800 cursor-text select-none overflow-y-auto max-h-[75px] whitespace-pre-wrap flex-1"
        >
          {text}
        </div>
      )}

      {/* Tiny bottom tag */}
      <div className="text-[7px] text-slate-500 font-mono text-right mt-1 cursor-default select-none">
        STICKY NOTE
      </div>

      <Handle type="target" position={Position.Left} style={{ background: "#CA8A04", width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: "#CA8A04", width: 6, height: 6 }} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (data.onDelete) data.onDelete(id);
        }}
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer shadow-md text-[8px] font-black z-30"
      >
        ✕
      </button>
    </div>
  );
}

export const nodeTypes = {
  archNode: ArchNode,
  textLabel: TextLabelNode,
  stickyNote: StickyNoteNode,
};
