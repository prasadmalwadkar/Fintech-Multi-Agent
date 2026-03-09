/**
 * Chat Panel component — unified text + voice input with markdown rendering
 * and streaming-style typing effect for AI responses.
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createSession, sendMessage, type ChatResponse } from "@/lib/api";
import { useVoice } from "@/hooks/useVoice";

interface LocalMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    agentName?: string;
    isStreaming?: boolean;
    isInterrupted?: boolean;
}

interface ChatPanelProps {
    activeAgentId: number | null;
}

// Agent badge colors
const agentColors: Record<string, string> = {
    "General Concierge": "from-blue-500 to-cyan-400",
    "Loan & Credit Specialist": "from-orange-500 to-amber-400",
    "Investment Advisor": "from-emerald-500 to-teal-400",
    "Fraud & Security Agent": "from-red-500 to-rose-400",
};

// Typing effect hook
function useTypingEffect(text: string, speed: number = 12, isInterrupted: boolean = false) {
    const [displayed, setDisplayed] = useState("");
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (isInterrupted) {
            setIsDone(true);
            return;
        }

        if (!text) {
            setDisplayed("");
            setIsDone(true);
            return;
        }

        setDisplayed("");
        setIsDone(false);
        let i = 0;
        const interval = setInterval(() => {
            // Reveal in chunks of 2-4 characters for faster, more natural feel
            const chunkSize = Math.floor(Math.random() * 3) + 2;
            i += chunkSize;
            if (i >= text.length) {
                setDisplayed(text);
                setIsDone(true);
                clearInterval(interval);
            } else {
                setDisplayed(text.slice(0, i));
            }
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed, isInterrupted]);

    return { displayed, isDone };
}

// Markdown renderer component for messages
function MessageContent({ content, isStreaming, isInterrupted }: { content: string; isStreaming?: boolean; isInterrupted?: boolean }) {
    const { displayed, isDone } = useTypingEffect(
        (isStreaming || isInterrupted) ? content : "",
        10,
        isInterrupted
    );

    const textToRender = (isStreaming || isInterrupted) ? displayed : content;

    return (
        <div className="prose prose-invert prose-sm max-w-none
            prose-p:my-1.5 prose-p:leading-relaxed
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-base prose-h2:mt-3 prose-h2:mb-1.5
            prose-h3:text-sm prose-h3:mt-2 prose-h3:mb-1
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:my-1.5 prose-ol:my-1.5
            prose-li:my-0.5 prose-li:text-gray-300
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
            prose-code:text-purple-300 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
        ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textToRender}
            </ReactMarkdown>
            {isStreaming && !isDone && (
                <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
            )}
        </div>
    );
}

export default function ChatPanel({ activeAgentId: _activeAgentId }: ChatPanelProps) {
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentAgent, setCurrentAgent] = useState("General Concierge");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wasListeningRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const isTyping = messages.some((m) => m.isStreaming);
    const isBusy = isLoading || isTyping;

    const handleStop = useCallback(() => {
        if (isLoading && abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        } else if (isTyping) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.isStreaming ? { ...m, isStreaming: false, isInterrupted: true } : m
                )
            );
        }
    }, [isLoading, isTyping]);

    const {
        isListening,
        transcript,
        startListening,
        stopListening,
        isSupported,
    } = useVoice();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Create session on mount
    useEffect(() => {
        const initSession = async () => {
            try {
                const session = await createSession();
                setSessionId(session.id);
                setMessages([
                    {
                        id: "welcome",
                        role: "system",
                        content:
                            "Welcome! You're connected to the **General Concierge**. Ask about loans, investments, or general banking to get started.",
                    },
                ]);
            } catch {
                setMessages([
                    {
                        id: "error",
                        role: "system",
                        content: "Failed to connect to the backend. Is the server running on port 8000?",
                    },
                ]);
            }
        };
        initSession();
    }, []);

    const handleSend = useCallback(
        async (text?: string) => {
            const messageText = text || input.trim();
            if (!messageText || !sessionId || isLoading) return;

            setInput("");
            const userMsg: LocalMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                content: messageText,
            };
            setMessages((prev) => [...prev, userMsg]);
            setIsLoading(true);

            try {
                abortControllerRef.current = new AbortController();
                const response: ChatResponse = await sendMessage(sessionId, messageText, abortControllerRef.current.signal);

                if (response.handoff_occurred && response.handoff_to) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `handoff-${Date.now()}`,
                            role: "system",
                            content: `→ Transferred to **${response.handoff_to}**`,
                        },
                    ]);
                }

                const assistantMsg: LocalMessage = {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: response.reply,
                    agentName: response.active_agent_name,
                    isStreaming: true,  // Enable typing effect for new messages
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setCurrentAgent(response.active_agent_name);

                // Mark as done streaming after a delay, but cap the max delay
                setTimeout(() => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
                        )
                    );
                }, Math.min(response.reply.length * 5 + 200, 3000));

            } catch (error: any) {
                if (error.name === "AbortError") {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `system-${Date.now()}`,
                            role: "system",
                            content: "Generation stopped by user.",
                        },
                    ]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `error-${Date.now()}`,
                            role: "system",
                            content: "Failed to get a response. Please try again.",
                        },
                    ]);
                }
            } finally {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        },
        [input, sessionId, isLoading]
    );

    // Handle voice transcript — send after user stops speaking
    useEffect(() => {
        if (isListening) {
            wasListeningRef.current = true;
        } else if (wasListeningRef.current && transcript) {
            wasListeningRef.current = false;
            handleSend(transcript);
        }
    }, [isListening, transcript, handleSend]);

    const handleNewSession = async () => {
        try {
            const session = await createSession();
            setSessionId(session.id);
            setCurrentAgent("General Concierge");
            setMessages([
                {
                    id: "welcome-new",
                    role: "system",
                    content: "New session started. Connected to **General Concierge**.",
                },
            ]);
        } catch {
            // ignore
        }
    };

    const gradientClass = agentColors[currentAgent] || "from-purple-500 to-blue-500";

    return (
        <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-[#0d1220]/60 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.015]">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-md`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Agent Chat</h2>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradientClass}`} />
                            <p className="text-[11px] text-gray-400">
                                <span className="text-gray-300 font-medium">{currentAgent}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleNewSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500
                       bg-white/[0.03] border border-white/[0.06] hover:text-white hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Chat
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
                    >
                        <div
                            className={`
                                max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                                ${msg.role === "user"
                                    ? "bg-gradient-to-r from-purple-600/90 to-blue-600/90 text-white rounded-br-md shadow-lg shadow-purple-500/10"
                                    : msg.role === "system"
                                        ? "bg-white/[0.03] text-gray-500 border border-white/[0.05] text-xs py-2"
                                        : "bg-white/[0.04] text-gray-200 border border-white/[0.06] rounded-bl-md"
                                }
                            `}
                        >
                            {msg.role === "assistant" && msg.agentName && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${agentColors[msg.agentName] || gradientClass}`} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        {msg.agentName}
                                    </span>
                                </div>
                            )}
                            {msg.role === "system" && msg.content.startsWith("→") && (
                                <span className="mr-1"></span>
                            )}
                            {msg.role === "assistant" ? (
                                <MessageContent content={msg.content} isStreaming={msg.isStreaming} isInterrupted={msg.isInterrupted} />
                            ) : msg.role === "system" ? (
                                <div className="prose prose-invert prose-xs max-w-none prose-p:my-0 prose-strong:text-gray-400">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-fadeIn">
                        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradientClass}`} />
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.015] space-y-2">
                {/* Live transcript banner */}
                {isListening && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.08] border border-red-400/[0.15] animate-fadeIn">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="text-xs text-red-300/80 font-medium flex-shrink-0">Listening</span>
                        <span className="text-sm text-gray-400 truncate">
                            {transcript || "Start speaking..."}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={isListening ? transcript : input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white
                         placeholder-gray-600 focus:outline-none focus:border-purple-500/30
                         focus:ring-1 focus:ring-purple-500/20 transition-all text-sm"
                        placeholder={isListening ? "Listening..." : "Type a message..."}
                        disabled={isBusy || isListening}
                        readOnly={isListening}
                    />

                    {/* Mic button */}
                    {isSupported && (
                        <button
                            onClick={isListening ? stopListening : startListening}
                            disabled={isBusy}
                            className={`
                                p-2.5 rounded-xl transition-all flex-shrink-0
                                ${isListening
                                    ? "bg-red-500/15 text-red-400 border border-red-400/25"
                                    : "bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:text-purple-400 hover:border-purple-400/25 hover:bg-purple-500/[0.05]"
                                }
                                disabled:opacity-40
                            `}
                            title={isListening ? "Stop" : "Voice input"}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </button>
                    )}

                    {/* Send button */}
                    {isBusy ? (
                        <button
                            onClick={handleStop}
                            className="p-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600
                             hover:from-red-500 hover:to-rose-500
                             transition-all shadow-lg shadow-red-500/15 text-white flex-shrink-0"
                            title="Stop generation"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSend()}
                            disabled={(!input.trim() && !isListening)}
                            className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                             hover:from-purple-500 hover:to-blue-500
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all shadow-lg shadow-purple-500/15 text-white flex-shrink-0"
                            title="Send message"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
