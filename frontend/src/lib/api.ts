/**
 * API client for the FastAPI backend.
 */

const API_BASE = "http://localhost:8000/api";

// ── Types ─────────────────────────────────────────────────────────────

export interface Agent {
    id: number;
    name: string;
    system_instructions: string;
    position_x: number;
    position_y: number;
}

export interface HandoffRule {
    id: number;
    source_agent_id: number;
    target_agent_id: number;
    trigger_condition: string;
}

export interface Session {
    id: number;
    current_active_agent_id: number;
    created_at: string;
}

export interface ChatMessage {
    id: number;
    session_id: number;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
}

export interface ChatResponse {
    reply: string;
    active_agent_id: number;
    active_agent_name: string;
    handoff_occurred: boolean;
    handoff_to: string | null;
}

// ── Agent API ─────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<Agent[]> {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error("Failed to fetch agents");
    return res.json();
}

export async function createAgent(data: {
    name: string;
    system_instructions: string;
    position_x?: number;
    position_y?: number;
}): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create agent");
    return res.json();
}

export async function updateAgent(
    id: number,
    data: Partial<Agent>
): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update agent");
    return res.json();
}

export async function deleteAgent(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete agent");
}

// ── Handoff Rule API ──────────────────────────────────────────────────

export async function fetchHandoffRules(): Promise<HandoffRule[]> {
    const res = await fetch(`${API_BASE}/handoff-rules`);
    if (!res.ok) throw new Error("Failed to fetch handoff rules");
    return res.json();
}

export async function createHandoffRule(data: {
    source_agent_id: number;
    target_agent_id: number;
    trigger_condition: string;
}): Promise<HandoffRule> {
    const res = await fetch(`${API_BASE}/handoff-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create handoff rule");
    return res.json();
}

export async function deleteHandoffRule(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/handoff-rules/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete handoff rule");
}

// ── Session API ──────────────────────────────────────────────────────

export async function createSession(): Promise<Session> {
    const res = await fetch(`${API_BASE}/sessions`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
}

export async function sendMessage(
    sessionId: number,
    message: string,
    signal?: AbortSignal
): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal,
    });
    if (!res.ok) throw new Error("Failed to send message");
    return res.json();
}

export async function fetchMessages(
    sessionId: number
): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
    if (!res.ok) throw new Error("Failed to fetch messages");
    return res.json();
}

// ── Canvas API ──────────────────────────────────────────────────────

export async function updateCanvasPositions(
    positions: { id: number; position_x: number; position_y: number }[]
): Promise<void> {
    const res = await fetch(`${API_BASE}/canvas/positions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
    });
    if (!res.ok) throw new Error("Failed to update positions");
}
