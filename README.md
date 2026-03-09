# Fintech Multi-Agent Orchestrator

A full-stack application that lets you visually build a network of AI agents on a drag-and-drop canvas, define handoff conditions between them, and test them via text and voice chat in real-time.

![Tech Stack](https://img.shields.io/badge/Next.js-React_Flow-blue) ![Backend](https://img.shields.io/badge/FastAPI-LangGraph-green) ![AI](https://img.shields.io/badge/Gemini_2.5-Google_AI-purple)

## Features

- **Drag-and-Drop Canvas** — Build agent networks visually with React Flow
- **AI Agent Handoffs** — Define conditions that trigger automatic agent transfers
- **Real-Time Chat** — Test your agent network via text or voice
- **Voice Mode** — Browser-native speech recognition + text-to-speech (zero cost)
- **Stop Generation** — Instantly halt AI responses mid-generation and stop the streaming text effect
- **LangGraph Orchestration** — State-managed routing with full conversation memory
- **Chunked Summary Buffer Memory** — Asynchronous background optimization to merge older messages into a rolling summary while keeping recent turns verbatim, saving tokens without latency hits.
- **Google Search Grounding** — Investment Advisor agent fetches live market data

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (20+ recommended)
- **Google Gemini API Key** — Get one free at [ai.google.dev](https://ai.google.dev)

## Quick Start

### 1. Clone & Configure

```bash
# Navigate to the project
cd "Fintech Multi-Agent"

# Create the backend .env file manually
touch backend/.env
```

Edit `backend/.env` and add your Gemini API key:
```
GEMINI_API_KEY=your-actual-gemini-api-key
```

### 2. Start the Backend

```bash
# Create a virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with docs at `/docs`.

### 3. Start the Frontend

```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────────┐
│   Next.js Frontend  │       │      FastAPI Backend         │
│                     │       │                              │
│  ┌───────────────┐  │  API  │  ┌────────────────────────┐  │
│  │  React Flow   │──┼───────┼──│  Agent/Rule CRUD       │  │
│  │  Canvas       │  │       │  └────────────────────────┘  │
│  └───────────────┘  │       │                              │
│  ┌───────────────┐  │       │  ┌────────────────────────┐  │
│  │  Chat Panel   │──┼───────┼──│  LangGraph Orchestrator│  │
│  │  Text + Voice │  │       │  │  ┌──────────────────┐  │  │
│  └───────────────┘  │       │  │  │  Gemini 2.5 Flash │  │  │
│                     │       │  │  │  + Google Search  │  │  │
└─────────────────────┘       │  │  └──────────────────┘  │  │
                              │  └────────────────────────┘  │
                              │  ┌────────────────────────┐  │
                              │  │  SQLite (SQLAlchemy)   │  │
                              │  └────────────────────────┘  │
                              └──────────────────────────────┘
```

## Pre-configured Agents

| Agent | Role | Special Capabilities |
|---|---|---|
| **General Concierge** | Account inquiries, balance checks, routing | Text-based routing |
| **Loan & Credit Specialist** | Mortgages, credit scores, loan FAQs | Text-based routing |
| **Investment Advisor** | Market analysis, stock research, portfolio advice | Google Search grounding for live data |

## How Routing Works

Gemini 2.5 does not allow combining built-in tools (Google Search) with custom function declarations in the same request. To work around this:

- **Agent routing** uses structured text markers (`[TRANSFER: AgentName]`) parsed by the backend — no function calling needed.
- **Google Search** is passed as the sole tool for the Investment Advisor, enabling real-time market data grounding without conflicts.
- The orchestrator detects transfer markers, updates the session, and re-invokes the new agent — all transparently.

## Memory Scope & Optimization

### Global Session Memory
Agents do not maintain isolated memories. When a chat session starts, all messages are saved under a single `session_id`. If an agent (e.g., General Concierge) transfers you to a specialist (e.g., Loan Specialist), the Orchestrator passes the *entire* relevant conversational history to the new agent. The new agent picks up right where the conversation left off.

### Chunked Summary Buffer Memory
To prevent the LLM context window from growing infinitely and to keep token costs low on long sessions:
- The system keeps the **5 most recent messages verbatim**.
- Once a session hits 10 unsummarized messages, the Orchestrator triggers an **asynchronous background task**.
- This task uses a low-temperature Gemini call to merge the oldest 5 messages into a rolling session summary.
- The active agent then receives: `[System Session Summary] + [5 Recent Verbatim Messages]`.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS + startup
│   │   ├── database.py          # SQLAlchemy (SQLite)
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── seed.py              # Seed 3 agents + 4 handoff rules
│   │   ├── routes/
│   │   │   ├── agents.py        # Agent & rule CRUD
│   │   │   ├── sessions.py      # Chat session endpoints
│   │   │   └── canvas.py        # Node position persistence
│   │   └── services/
│   │       ├── gemini.py        # Gemini API + text-based routing
│   │       └── orchestrator.py  # LangGraph routing + handoffs
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Main layout (canvas + chat)
│       │   ├── layout.tsx        # Root layout + fonts
│       │   └── globals.css       # Dark theme + animations
│       ├── components/
│       │   ├── Canvas.tsx        # React Flow canvas
│       │   ├── AgentNode.tsx     # Custom agent node
│       │   ├── NodeEditor.tsx    # Agent editor modal
│       │   ├── EdgeEditor.tsx    # Handoff condition modal
│       │   └── ChatPanel.tsx     # Text + voice chat
│       ├── hooks/
│       │   └── useVoice.ts       # Web Speech API hook
│       └── lib/
│           └── api.ts            # Backend API client
└── README.md
```

## Usage

1. **Canvas**: Drag the pre-built agent nodes around. Click "Add Agent" to create new ones.
2. **Edges**: Drag from a node's right handle to another node's left handle to create a handoff rule. Set the trigger condition in the popup.
3. **Chat (Text)**: Type a message in the chat panel. The General Concierge will respond. Ask about loans → automatic handoff to Loan Specialist. Ask about stocks → handoff to Investment Advisor.
4. **Chat (Voice)**: Toggle to Voice mode. Click the mic button, speak, and the response will be read aloud.
5. **Stop Generation**: While the AI is responding, click the red Stop button to instantly cancel the request and halt the typing effect.

## License

MIT
