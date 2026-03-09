/**
 * React Flow canvas component — the visual agent builder.
 * Loads agents/edges from the backend, allows drag-and-drop, and supports adding/editing/deleting.
 */

"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    BackgroundVariant,

    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type Connection,
    type NodeTypes,
    MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import AgentNodeComponent, { type AgentNodeData } from "./AgentNode";
import NodeEditor from "./NodeEditor";
import EdgeEditor from "./EdgeEditor";
import {
    fetchAgents,
    fetchHandoffRules,
    createAgent,
    updateAgent,
    deleteAgent as deleteAgentAPI,
    createHandoffRule,
    deleteHandoffRule,
    updateCanvasPositions,
    type Agent,
    type HandoffRule,
} from "@/lib/api";

interface CanvasProps {
    activeAgentId: number | null;
}

export default function Canvas({ activeAgentId }: CanvasProps) {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [handoffRules, setHandoffRules] = useState<HandoffRule[]>([]);

    // Editor state
    const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [edgeEditorOpen, setEdgeEditorOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

    // Define node types
    const nodeTypes: NodeTypes = useMemo(
        () => ({ agentNode: AgentNodeComponent }),
        []
    );

    // ── Load Data ───────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            const [agentsData, rulesData] = await Promise.all([
                fetchAgents(),
                fetchHandoffRules(),
            ]);
            setAgents(agentsData);
            setHandoffRules(rulesData);
        } catch (err) {
            console.error("Failed to load canvas data:", err);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Sync agents/rules → React Flow nodes/edges ─────────────────────

    const handleEdit = useCallback((agentId: number) => {
        const agent = agents.find((a) => a.id === agentId) ?? null;
        setEditingAgent(agent);
        setNodeEditorOpen(true);
    }, [agents]);

    const handleDelete = useCallback(async (agentId: number) => {
        try {
            await deleteAgentAPI(agentId);
            await loadData();
        } catch (err) {
            console.error("Failed to delete agent:", err);
        }
    }, [loadData]);

    useEffect(() => {
        const newNodes: Node[] = agents.map((agent) => ({
            id: String(agent.id),
            type: "agentNode",
            position: { x: agent.position_x, y: agent.position_y },
            data: {
                label: agent.name,
                systemInstructions: agent.system_instructions,
                agentId: agent.id,
                onEdit: handleEdit,
                onDelete: handleDelete,
                isActive: agent.id === activeAgentId,
            } as AgentNodeData,
        }));

        const newEdges: Edge[] = handoffRules.map((rule) => ({
            id: `edge-${rule.id}`,
            source: String(rule.source_agent_id),
            target: String(rule.target_agent_id),
            label: rule.trigger_condition.length > 30
                ? rule.trigger_condition.slice(0, 30) + "..."
                : rule.trigger_condition,
            animated: true,
            style: { stroke: "#a855f7", strokeWidth: 2 },
            labelStyle: { fill: "#c4b5fd", fontSize: 10, fontWeight: 500 },
            labelBgStyle: { fill: "#1e1b4b", fillOpacity: 0.8 },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 4,
            data: { ruleId: rule.id },
        }));

        setNodes(newNodes);
        setEdges(newEdges);
    }, [agents, handoffRules, activeAgentId, handleEdit, handleDelete]);

    // ── Handlers ────────────────────────────────────────────────────────

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            setNodes((nds) => applyNodeChanges(changes, nds));

            // Persist position changes (debounce to final positions)
            const posChanges = changes.filter(
                (c) => c.type === "position" && "position" in c && c.position && !c.dragging
            );
            if (posChanges.length > 0) {
                const positions = posChanges.map((c) => ({
                    id: Number((c as { id: string }).id),
                    position_x: (c as { position: { x: number; y: number } }).position.x,
                    position_y: (c as { position: { x: number; y: number } }).position.y,
                }));
                updateCanvasPositions(positions).catch(console.error);
            }
        },
        []
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            // Handle edge removal
            for (const change of changes) {
                if (change.type === "remove") {
                    const edge = edges.find((e) => e.id === change.id);
                    if (edge && edge.data?.ruleId) {
                        deleteHandoffRule(edge.data.ruleId as number).catch(console.error);
                    }
                }
            }
            setEdges((eds) => applyEdgeChanges(changes, eds));
        },
        [edges]
    );

    const onConnect: OnConnect = useCallback(
        (connection) => {
            setPendingConnection(connection);
            setEdgeEditorOpen(true);
        },
        []
    );

    // ── Add New Agent ────────────────────────────────────────────────────

    const handleAddAgent = () => {
        setEditingAgent(null);
        setNodeEditorOpen(true);
    };

    const handleSaveAgent = async (data: { name: string; system_instructions: string }) => {
        try {
            if (editingAgent) {
                await updateAgent(editingAgent.id, data);
            } else {
                await createAgent({
                    ...data,
                    position_x: 250 + Math.random() * 200,
                    position_y: 150 + Math.random() * 200,
                });
            }
            await loadData();
        } catch (err) {
            console.error("Failed to save agent:", err);
        }
    };

    const handleSaveEdge = async (condition: string) => {
        if (!pendingConnection) return;
        try {
            await createHandoffRule({
                source_agent_id: Number(pendingConnection.source),
                target_agent_id: Number(pendingConnection.target),
                trigger_condition: condition,
            });
            await loadData();
        } catch (err) {
            console.error("Failed to create handoff rule:", err);
        }
        setPendingConnection(null);
    };

    const getAgentName = (id: string | null) => {
        if (!id) return "";
        const agent = agents.find((a) => a.id === Number(id));
        return agent?.name || "";
    };

    return (
        <div className="relative h-full rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-xl overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                    onClick={handleAddAgent}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white
                     bg-gradient-to-r from-purple-600 to-blue-600
                     hover:from-purple-500 hover:to-blue-500
                     transition-all shadow-lg shadow-purple-500/20"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Agent
                </button>
            </div>

            {/* Title Badge */}
            <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-gray-400">
                    <span className="text-purple-300 font-medium">{agents.length}</span> agents ·{" "}
                    <span className="text-blue-300 font-medium">{handoffRules.length}</span> rules
                </p>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                className="bg-transparent"
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color="rgba(139, 92, 246, 0.15)"
                />
                <Controls className="!bg-gray-900/80 !border-white/10 !rounded-xl [&>button]:!bg-white/5 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/10" />
                <MiniMap
                    className="!bg-gray-900/80 !border-white/10 !rounded-xl"
                    nodeColor={() => "#a855f7"}
                    maskColor="rgba(0,0,0,0.5)"
                />
            </ReactFlow>

            {/* Node Editor Modal */}
            <NodeEditor
                isOpen={nodeEditorOpen}
                onClose={() => setNodeEditorOpen(false)}
                onSave={handleSaveAgent}
                initialData={
                    editingAgent
                        ? { name: editingAgent.name, system_instructions: editingAgent.system_instructions }
                        : null
                }
                title={editingAgent ? "Edit Agent" : "Create New Agent"}
            />

            {/* Edge Editor Modal */}
            <EdgeEditor
                isOpen={edgeEditorOpen}
                onClose={() => {
                    setEdgeEditorOpen(false);
                    setPendingConnection(null);
                }}
                onSave={handleSaveEdge}
                sourceName={getAgentName(pendingConnection?.source ?? null)}
                targetName={getAgentName(pendingConnection?.target ?? null)}
            />
        </div>
    );
}
