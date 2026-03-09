/**
 * Modal editor for setting a handoff condition on an edge.
 */

"use client";

import React, { useState, useEffect } from "react";

interface EdgeEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (condition: string) => void;
    sourceName: string;
    targetName: string;
    initialCondition?: string;
}

export default function EdgeEditor({
    isOpen,
    onClose,
    onSave,
    sourceName,
    targetName,
    initialCondition,
}: EdgeEditorProps) {
    const [condition, setCondition] = useState("");

    useEffect(() => {
        setCondition(initialCondition || "");
    }, [initialCondition, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">Handoff Condition</h2>
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
                    <div className="flex items-center gap-3 text-sm">
                        <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-medium">
                            {sourceName}
                        </span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-medium">
                            {targetName}
                        </span>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Transfer Condition
                        </label>
                        <textarea
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white
                         placeholder-gray-500 focus:outline-none focus:border-purple-400/50
                         focus:ring-1 focus:ring-purple-400/30 transition-all resize-none"
                            placeholder="e.g. User asks about loans, mortgages, or credit..."
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
                            if (condition.trim()) {
                                onSave(condition.trim());
                                onClose();
                            }
                        }}
                        disabled={!condition.trim()}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white
                       bg-gradient-to-r from-purple-600 to-blue-600
                       hover:from-purple-500 hover:to-blue-500
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-purple-500/20"
                    >
                        Save Condition
                    </button>
                </div>
            </div>
        </div>
    );
}
