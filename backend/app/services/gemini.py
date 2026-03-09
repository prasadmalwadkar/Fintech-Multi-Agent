"""
Gemini API wrapper — handles LLM calls with structured text-based routing.
Uses the official google-genai SDK.

NOTE: Gemini 2.5 does not allow combining built-in tools (Google Search)
with custom function declarations in the same request. To avoid this
conflict, agent routing uses structured text markers instead of function
calling. The model outputs [TRANSFER: AgentName] when a handoff is needed,
and the parser detects it automatically.
"""

import os
import re

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

_client = None
MODEL_ID = "gemini-2.5-flash"


def _get_client() -> genai.Client:
    """Lazy-initialize the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY is not set. Please create backend/.env with your Gemini API key."
            )
        _client = genai.Client(api_key=api_key)
    return _client


# ── Google Search tool (Investment Advisor only) ─────────────────────────

GOOGLE_SEARCH_TOOL = types.Tool(google_search=types.GoogleSearch())


# ── Transfer detection regex ─────────────────────────────────────────────

_TRANSFER_PATTERN = re.compile(
    r"\[TRANSFER:\s*([^\]]+)\]",
)

# Broader fallback pattern for when the model describes transfers in prose
_TRANSFER_FALLBACK = re.compile(
    r"(?:transfer(?:ring)?\s+(?:you\s+)?to|hand(?:ing)?\s+(?:you\s+)?(?:off\s+)?to|connect(?:ing)?\s+you\s+(?:with|to))\s+['\"]?([^'\"\.!\?\n]+)",
    re.IGNORECASE,
)


def build_system_instruction(
    agent_name: str,
    system_instructions: str,
    available_targets: list[str],
) -> str:
    """Build the full system prompt with routing instructions."""
    targets_str = ", ".join(f"'{t}'" for t in available_targets)
    return (
        f"{system_instructions}\n\n"
        f"AVAILABLE TRANSFER TARGETS: {targets_str}\n\n"
        f"TRANSFER PROTOCOL (CRITICAL — follow exactly):\n"
        f"- When the user's request is ENTIRELY better handled by another agent, output ONLY the "
        f"transfer marker on its own line with NO other text:\n"
        f"  [TRANSFER: ExactAgentName]\n"
        f"- Example: [TRANSFER: Loan & Credit Specialist]\n"
        f"- Do NOT add any explanation, greeting, or other text when transferring.\n"
        f"- If the request contains multiple questions and AT LEAST ONE is within your expertise, respond normally to the part you know and DO NOT transfer.\n"
        f"- If the user says they were just transferred to you, DO NOT transfer them again. Answer what you can.\n\n"
        f"RESPONSE STYLE GUIDELINES (CRITICAL):\n"
        f"- KEEP RESPONSES EXTREMELY CONCISE. Aim for 2-4 sentences maximum unless explicitly asked for a long explanation.\n"
        f"- Do not provide unprompted background information or overly verbose polite filler."
    )


def _build_contents(messages: list[dict]) -> list[types.Content]:
    """Convert message dicts to Gemini Content objects."""
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg["content"])],
        ))
    return contents


def _extract_text_from_response(response) -> str:
    """
    Extract text from a Gemini response, handling Gemini 2.5 thinking mode.
    Gemini 2.5 may return 'thought' parts (internal reasoning) alongside
    regular text parts. We only want the non-thought text.
    """
    if not response.candidates or not response.candidates[0].content:
        return ""

    content = response.candidates[0].content
    if not content.parts:
        return ""

    text_parts = []
    for part in content.parts:
        # Skip thinking/thought parts (Gemini 2.5 feature)
        if hasattr(part, "thought") and part.thought:
            continue
        if part.text:
            text_parts.append(part.text)

    return " ".join(text_parts).strip()


def _parse_response(response, available_targets: list[str] | None = None) -> dict:
    """Parse a Gemini response. Detects [TRANSFER: AgentName] markers."""
    full_text = _extract_text_from_response(response)

    if not full_text:
        # If no non-thought text was found, try ALL parts as a last resort
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            all_text = []
            for part in response.candidates[0].content.parts:
                if part.text:
                    all_text.append(part.text)
            full_text = " ".join(all_text).strip()

    if not full_text:
        return {"text": "I'm sorry, I couldn't generate a response.", "tool_call": None}

    # Detect [TRANSFER: AgentName] marker
    if available_targets:
        match = _TRANSFER_PATTERN.search(full_text)
        if match:
            mentioned_name = match.group(1).strip()
            for target in available_targets:
                if target.lower() == mentioned_name.lower() or \
                   target.lower() in mentioned_name.lower() or \
                   mentioned_name.lower() in target.lower():
                    return {
                        "text": None,
                        "tool_call": {
                            "name": "transfer_to_agent",
                            "args": {
                                "target_agent_name": target,
                                "reason": "User request is better suited for this specialist.",
                            },
                        },
                    }

        # Broader fallback: detect prose-based transfer intent
        fallback_match = _TRANSFER_FALLBACK.search(full_text)
        if fallback_match:
            mentioned_name = fallback_match.group(1).strip()
            for target in available_targets:
                if target.lower() in mentioned_name.lower() or \
                   mentioned_name.lower() in target.lower():
                    return {
                        "text": None,
                        "tool_call": {
                            "name": "transfer_to_agent",
                            "args": {
                                "target_agent_name": target,
                                "reason": "User request is better suited for this specialist.",
                            },
                        },
                    }

    # Clean any stray transfer markers from the response text
    clean_text = _TRANSFER_PATTERN.sub("", full_text).strip()
    # Also clean any prose-based transfer text
    clean_text = _TRANSFER_FALLBACK.sub("", clean_text).strip()

    return {
        "text": clean_text if clean_text else "I'm here to help! Could you please rephrase your question?",
        "tool_call": None,
    }


async def summarize_message_chunk(current_summary: str, new_messages: list[dict]) -> str:
    """
    Summarize a chunk of messages asynchronously, merging with the existing summary.
    """
    system_instruction = (
        "You are an AI assistant that distills conversation histories into concise summaries. "
        "Keep the summary focused on the user's goals, key facts, and the state of the task."
    )
    
    messages_text = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in new_messages])
    prompt = f"Current Summary:\n{current_summary if current_summary else 'No previous summary.'}\n\nNew Conversation:\n{messages_text}\n\nWrite a single, cohesive, updated summary integrating the new conversation with the current summary."
    
    try:
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3,
        )
        
        response = _get_client().models.generate_content(
            model=MODEL_ID,
            contents=[prompt],
            config=config,
        )
        
        return _extract_text_from_response(response)
    except Exception as e:
        print(f"[Gemini ERROR] Summarization failed: {e}")
        return current_summary


async def call_gemini(
    agent_name: str,
    system_instructions: str,
    messages: list[dict],
    available_targets: list[str],
) -> dict:
    """
    Call Gemini with the given agent context and message history.

    - All agents: called WITHOUT function declarations (avoids Gemini 2.5
      built-in tool conflicts). Routing uses [TRANSFER: AgentName] markers.
    - Investment Advisor: gets Google Search for real-time grounding.

    Returns:
        {
            "text": str | None,
            "tool_call": {"name": str, "args": dict} | None,
        }
    """
    system_prompt = build_system_instruction(agent_name, system_instructions, available_targets)
    contents = _build_contents(messages)

    # Investment Advisor gets Google Search; all others get no tools
    use_search = agent_name == "Investment Advisor"

    try:
        if use_search:
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[GOOGLE_SEARCH_TOOL],
                temperature=0.7,
            )
        else:
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            )

        response = _get_client().models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=config,
        )

        # Debug logging for troubleshooting
        if response.candidates and response.candidates[0].content:
            parts = response.candidates[0].content.parts or []
            print(f"[Gemini] Agent={agent_name}, Parts={len(parts)}")
            for i, part in enumerate(parts):
                is_thought = hasattr(part, 'thought') and part.thought
                has_text = bool(part.text) if part.text else False
                print(f"  Part {i}: thought={is_thought}, has_text={has_text}, text_preview={repr(part.text[:80]) if part.text else 'None'}")
        else:
            print(f"[Gemini] Agent={agent_name}, No candidates or content!")

        return _parse_response(response, available_targets)

    except Exception as e:
        print(f"[Gemini ERROR] Agent={agent_name}, Error={e}")
        return {"text": f"I'm sorry, I encountered an error: {str(e)}", "tool_call": None}
