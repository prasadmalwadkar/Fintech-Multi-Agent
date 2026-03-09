/**
 * Custom Agent Node component for React Flow canvas.
 * Shows agent name, a truncated system prompt, and action buttons.
 */

"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface AgentNodeData {
    label: string;
    systemInstructions: string;
    agentId: number;
    onEdit: (agentId: number) => void;
    onDelete: (agentId: number) => void;
    isActive?: boolean;
    [key: string]: unknown;
}

function AgentNodeComponent({ data }: NodeProps) {
    const nodeData = data as unknown as AgentNodeData;
    const truncatedPrompt =
        nodeData.systemInstructions && nodeData.systemInstructions.length > 80
            ? nodeData.systemInstructions.slice(0, 80) + "..."
            : nodeData.systemInstructions || "";

    return (
        <div
            className={`
        relative min-w-[220px] rounded-xl border backdrop-blur-md
        transition-all duration-300 hover:scale-[1.02]
        ${nodeData.isActive
                    ? "border-purple-400/60 bg-purple-900/40 shadow-lg shadow-purple-500/20"
                    : "border-white/10 bg-white/5 shadow-md shadow-black/20"
                }
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div
                        className={`w-2.5 h-2.5 rounded-full ${nodeData.isActive
                                ? "bg-green-400 animate-pulse"
                                : "bg-gray-500"
                            }`}
                    />
                    <h3 className="text-sm font-semibold text-white truncate max-w-[140px]">
                        {nodeData.label}
                    </h3>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            nodeData.onEdit(nodeData.agentId);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Edit Agent"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            nodeData.onDelete(nodeData.agentId);
                        }}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete Agent"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
                <p className="text-xs text-gray-400 leading-relaxed">{truncatedPrompt}</p>
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600"
            />
        </div>
    );
}

export default memo(AgentNodeComponent);
