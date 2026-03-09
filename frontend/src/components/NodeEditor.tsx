/**
 * Modal editor for creating or editing an Agent node.
 */

"use client";

import React, { useState, useEffect } from "react";

interface NodeEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; system_instructions: string }) => void;
    initialData?: { name: string; system_instructions: string } | null;
    title: string;
}

export default function NodeEditor({
    isOpen,
    onClose,
    onSave,
    initialData,
    title,
}: NodeEditorProps) {
    const [name, setName] = useState("");
    const [instructions, setInstructions] = useState("");

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setInstructions(initialData.system_instructions);
        } else {
            setName("");
            setInstructions("");
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Agent Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white
                         placeholder-gray-500 focus:outline-none focus:border-purple-400/50
                         focus:ring-1 focus:ring-purple-400/30 transition-all"
                            placeholder="e.g. Loan Specialist"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            System Prompt / Topic
                        </label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows={6}
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white
                         placeholder-gray-500 focus:outline-none focus:border-purple-400/50
                         focus:ring-1 focus:ring-purple-400/30 transition-all resize-none"
                            placeholder="Describe this agent's role, capabilities, and behavior..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white
                       hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (name.trim()) {
                                onSave({
                                    name: name.trim(),
                                    system_instructions: instructions.trim(),
                                });
                                onClose();
                            }
                        }}
                        disabled={!name.trim()}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white
                       bg-gradient-to-r from-purple-600 to-blue-600
                       hover:from-purple-500 hover:to-blue-500
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-purple-500/20"
                    >
                        Save Agent
                    </button>
                </div>
            </div>
        </div>
    );
}
