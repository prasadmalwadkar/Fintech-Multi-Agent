/**
 * Main application page — Chat-first layout with slide-out Canvas drawer.
 */

"use client";

import React, { useState } from "react";
import Canvas from "@/components/Canvas";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [activeAgentId, _setActiveAgentId] = useState<number | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  return (
    <div className="relative flex flex-col h-screen bg-[#0a0e1a] text-white overflow-hidden">
      {/* Ambient background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-teal-500/[0.04] blur-[100px]" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                FinAgent
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Canvas toggle button */}
          <button
            onClick={() => setIsCanvasOpen(!isCanvasOpen)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
              ${isCanvasOpen
                ? "bg-purple-500/20 text-purple-300 border border-purple-400/30 shadow-lg shadow-purple-500/10"
                : "bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15]"
              }
            `}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Agent Canvas
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-medium">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Chat Panel (main area) */}
        <div className={`transition-all duration-500 ease-in-out ${isCanvasOpen ? "w-[45%]" : "w-full"} p-4`}>
          <ChatPanel activeAgentId={activeAgentId} />
        </div>

        {/* Canvas Panel — slide-out from right */}
        <div
          className={`
            absolute top-0 right-0 h-full transition-all duration-500 ease-in-out
            ${isCanvasOpen ? "w-[55%] opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-full"}
          `}
        >
          <div className="h-full p-4 pl-0">
            <div className="h-full rounded-2xl border border-white/[0.08] bg-[#0d1220]/80 backdrop-blur-xl overflow-hidden relative">
              {/* Canvas header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span className="text-sm font-semibold text-white">Agent Network</span>
                  <span className="text-[10px] text-gray-500 bg-white/[0.05] px-2 py-0.5 rounded-full">drag to reorder</span>
                </div>
                <button
                  onClick={() => setIsCanvasOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-gray-500 hover:text-white transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {isCanvasOpen && (
                <div className="h-[calc(100%-48px)]">
                  <Canvas activeAgentId={activeAgentId} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
