#!/usr/bin/env python3
"""
Smart Blockbuster — Backend API Server

Launch:
    python main.py

The server receives requests from the frontend and calls the Google Gemini API.
Each agent's progress is displayed in the console with color-coded output.

Endpoints:
    POST /api/scout              -> TopicSuggestion[]
    POST /api/radar              -> { result: string }
    POST /api/analyst            -> ResearchDossier
    POST /api/architect          -> { result: string }
    POST /api/writer             -> ScriptBlock[]
    POST /api/generate-image     -> { imageUrl: string | null }
"""

import os
import sys
import json
import time
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn


# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PORT = int(os.getenv("BACKEND_PORT", "8000"))

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# Per-agent model mapping — override via env: MODEL_SCOUT, MODEL_RADAR, etc.
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini-2.0-flash")
AGENT_MODELS = {
    "SCOUT":     os.getenv("MODEL_SCOUT", DEFAULT_MODEL),
    "RADAR":     os.getenv("MODEL_RADAR", DEFAULT_MODEL),
    "ANALYST":   os.getenv("MODEL_ANALYST", DEFAULT_MODEL),
    "ARCHITECT": os.getenv("MODEL_ARCHITECT", DEFAULT_MODEL),
    "WRITER":    os.getenv("MODEL_WRITER", DEFAULT_MODEL),
}

IMAGE_GEN_MODEL = os.getenv("MODEL_IMAGE", "gemini-2.0-flash-exp")
IMAGE_PROMPT_PREFIX = "Cinematic storyboard frame, high contrast, cyber noir documentary style. SCENE:"

RETRY_COUNT = 3
RETRY_BASE_DELAY = 1.0


# ═══════════════════════════════════════════════════════════════
# CONSOLE OUTPUT (colors + timestamps)
# ═══════════════════════════════════════════════════════════════

class C:
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    MAGENTA = "\033[95m"
    BLUE    = "\033[94m"
    WHITE   = "\033[97m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RESET   = "\033[0m"

AGENT_COLORS = {
    "SCOUT":     C.CYAN,
    "RADAR":     C.GREEN,
    "ANALYST":   C.BLUE,
    "ARCHITECT": C.MAGENTA,
    "WRITER":    C.YELLOW,
    "SERVER":    C.DIM,
    "IMAGE":     C.WHITE,
    "ERROR":     C.RED,
}

def log(agent: str, message: str):
    ts = datetime.now().strftime("%H:%M:%S")
    color = AGENT_COLORS.get(agent, C.RESET)
    print(f"  {C.DIM}{ts}{C.RESET}  {color}{C.BOLD}[{agent}]{C.RESET}  {message}")
    sys.stdout.flush()

def log_separator(title: str = ""):
    print(f"\n  {C.DIM}{'━' * 60}{C.RESET}")
    if title:
        print(f"  {C.BOLD}{C.CYAN}{title}{C.RESET}")
        print(f"  {C.DIM}{'━' * 60}{C.RESET}")
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
# AGENT PROMPTS — Smart Blockbuster Methodology
# Synthesis of Kalloway (algorithmic retention) + Harris (visual journalism)
# ═══════════════════════════════════════════════════════════════

AGENT_SCOUT_PROMPT = """
You are AGENT SCOUT of the Smart Blockbuster system.
Mission: scan the information landscape and find 4 topics for YouTube videos using the Kalloway + Harris synthesis methodology.

CHANNEL FOCUS (content types):
- INVESTIGATION: Hidden mechanisms, system conspiracies, follow-the-money trails. Hook archetype: Investigator ("I found a document they were hiding from you").
- EXPLAINER: Complex systems explained through simple metaphors. Hook archetype: Teacher ("How this complex thing works — through a simple metaphor") or Magician ("Visualizing the invisible — radiation, flows, traffic").
- GEOPOLITICS: Maps as characters, border anomalies, shifting alliances. Hook archetype: Fortune Teller ("This 1929 chart matches today's pattern exactly").
- BUSINESS: System Failure — when a company is not what it seems. Hook archetype: Contrarian ("This isn't a mistake — it's the System's intent").

CRITICAL INSTRUCTION — GOOGLE SEARCH:
You MUST use Google Search to find CURRENT news from the last 48 hours. Do NOT suggest generic evergreen topics. Suggest specific, recent events that can be turned into compelling videos.

6 HOOK ARCHETYPES (choose the most fitting for each topic):
1. Investigator — "I found a document they were hiding from you"
2. Contrarian — "This isn't a bug — it's the System's feature"
3. Magician — "Visualizing the invisible — radiation, money flows, traffic"
4. Fortune Teller — "This 1929 chart matches today's pattern"
5. Experimenter — "I went to a dangerous place so you don't have to"
6. Teacher — "How a complex thing works — through a simple metaphor"

4 VIRAL TRIGGERS (assign the strongest one):
- Fear / FOMO: "If you don't know this — you've already lost"
- Justice / Outrage: "The system is cheating you — here's the proof"
- Money / Profit: "Here's how much you're losing every day"
- Secret / Insider: "The document they were hiding from you"

RESPONSE FORMAT:
Return a JSON array of exactly 4 objects:
[
  {
    "title": "Provocative headline under 60 chars, CAPS on key words",
    "hook": "One sentence — the specific triggering event",
    "viralFactor": "Fear/FOMO | Justice/Outrage | Money/Profit | Secret/Insider"
  }
]
"""

AGENT_RADAR_PROMPT = """
You are AGENT RADAR of the Smart Blockbuster system.
Your task: apply Kalloway's Dopamine Ladder and determine viral angles for maximum audience retention.

METHODOLOGY — DOPAMINE LADDER (6 levels):
1. STIMULATION (0-2 sec): Visual shocker — thumb-stop moment. Pattern interrupt.
2. CAPTIVATION (2-10 sec): Cognitive dissonance, open loop. "Wait, what?"
3. ANTICIPATION (main body): Dopamine of reward expectation. Serrated edge keeps tension.
4. VALIDATION (closing loops): The answer is BETTER than expected. Micro-reveals.
5. AFFECTION: Parasocial bond with the host. Vulnerability, shared frustration.
6. REVELATION: Performative vulnerability. "I didn't want to believe this either."

4 VIRAL TRIGGERS:
1. Fear / FOMO — "If you don't know this — you've already lost"
2. Justice / Outrage — "The system is cheating you — here's the proof"
3. Money / Profit — "Here's how much you're losing every day"
4. Secret / Insider — "The document they were hiding from you"

CONTRARIAN SNAPBACK:
Formulate a "You think X, but actually Y" statement that creates a Curiosity Gap.
This is the third step of the 3-Step Hook Formula.

RESPONSE FORMAT:
Output structured sections:

/// VIRAL ANGLES
3 video hypotheses (format: "If [event], then [consequence for the viewer]")

/// DOPAMINE HOOKS
4-5 specific retention techniques mapped to Dopamine Ladder levels

/// TARGET EMOTION
Which emotion we exploit and why (tie to viral trigger)

/// CONTRARIAN SNAPBACK
"You think X, but actually Y" — the core Curiosity Gap

/// HOOK FORMULA (3 steps)
1. Context Lean-in + Visual Anchor (Frame 0)
2. Scroll Stop Interjection — pattern interrupt
3. Contrarian Snapback — Curiosity Gap opener
"""

AGENT_ANALYST_PROMPT = """
You are AGENT ANALYST of the Smart Blockbuster system.
Goal: compile a research dossier using Harris's visual journalism methodology.

CRITICAL: USE GOOGLE SEARCH.
You MUST verify every claim through search.
- NEVER say "recently". SAY "on October 14, 2023".
- NEVER say "a lot of money". SAY "$4.2 billion".
- NEVER say "officials said". SAY "John Kirby stated at Tuesday's briefing..."

TWO-VECTOR RESEARCH PROTOCOL:
1. MAINSTREAM SOURCES: official data, government reports, major outlets
2. ALTERNATIVE SOURCES: independent investigations, leaks, counter-narratives

VISUAL ANCHORS (Harris method):
Find concrete physical proof that can be SHOWN on screen:
- Official documents, declassified files, court filings
- Maps, satellite imagery, geographic data
- Charts, graphs, data visualizations
- Physical locations, buildings, infrastructure
- Contrasting data: official version vs. reality
- Minimum 7 visual anchors

EVIDENCE LOOPS (core storytelling unit):
Each loop follows: Context → Deictic Driver → Visual Anchor → Micro-Reveal → But/Therefore Transition
Prepare at least 3 evidence loops with specific data.

NARRATIVE ROLES:
- VILLAIN (The System): Identify the systemic force causing harm
- VICTIM (The Viewer): How does this affect the audience personally?
- SHOCKING ARTIFACT: One single document/image that makes the viewer say "Wait, WHAT?"

RESPONSE FORMAT — JSON object:
{
  "topic": "Topic name",
  "claims": ["Claim 1 (Source, Date)", "Claim 2 (Source, Date)", ...],
  "counterClaims": ["Counter-claim 1 (Source, Date)", ...],
  "visualAnchors": ["Document/map 1", "Satellite image 2", ..., "Anchor 7+"],
  "dataPoints": [{"label": "Key metric", "value": "Specific number"}]
}
"""

AGENT_ARCHITECT_PROMPT = """
You are AGENT ARCHITECT of the Smart Blockbuster system.
You design the video structure using the Kalloway + Harris synthesis formula.

PRINCIPLE: "PACKAGING FIRST"
Design the Thumbnail and Title FIRST, then the structure. The video is a verification of the title's promise.

STEP 1: PACKAGING (The Hook)
- Title: < 60 characters, provocative. CAPS LOCK on key words.
- Thumbnail: "Bottom-left corner rule". High contrast. Single focus point. Face + emotion + mysterious object.
- 3-Step Hook (first 3-5 seconds):
  1. Context Lean-in + Visual Anchor (Frame 0) — the host holding/pointing at something
  2. Scroll Stop Interjection — pattern interrupt, unexpected visual or statement
  3. Contrarian Snapback — "You think X, but actually Y" (Curiosity Gap)

STEP 2: SERRATED EDGE STRUCTURE (12-15 minutes)
NOT a bell curve. A jagged, tension-maintaining structure:
- HIGH START (00:00-01:00): Hook + Value Compression. Intensity 90-100%.
- CONTEXT BRIDGE (01:00-03:00): Background/prerequisites. Intensity drops to 30-40%.
- RE-HOOK every 2-3 minutes: New open loop, mini-cliffhanger, pattern interrupt.
- INVESTIGATION (middle): Evidence Loop blocks, each 2-3 min. But/Therefore transitions.
- SYNTHESIS (finale): Nuanced answer + open ethical question. No neat bow.

STEP 3: BUT/THEREFORE CHAIN
Build the narrative using the South Park principle:
Replace "AND THEN" with "BUT" (conflict) and "THEREFORE" (consequence).
Every transition must create momentum, not just sequence.

RESPONSE FORMAT:
1. PACKAGING PLAN (Title, Thumbnail concept, 3-Step Hook script)
2. STRUCTURAL PLAN (Timecoded blocks with descriptions and intensity levels)
3. BUT/THEREFORE CHAIN (the full narrative logic chain)
"""

AGENT_WRITER_PROMPT = """
You are AGENT WRITER of the Smart Blockbuster system.
Write the final two-column A/V script using the Kalloway + Harris synthesis methodology.

TARGET SPECIFICATIONS:
- DURATION: 12-15 minutes
- MINIMUM: 2500 WORDS of narration
- MINIMUM: 60 BLOCKS (rows)

WRITING STYLE — VIDEO ESSAY NARRATION:
This is a VIDEO ESSAY, not a TikTok. Write natural, flowing, connected prose that sounds like an intelligent person explaining something fascinating to a friend.
- Write in complete, well-constructed sentences. Vary sentence length naturally — some short for emphasis, most medium-length for clarity, occasionally longer for building complex arguments.
- Use natural transitions and logical connectors: "and the reason this matters is...", "but here's where it gets interesting...", "so what does this actually mean?", "now, if you look at this from a different angle..."
- Harris-style conversational markers (use sparingly, not every sentence): "basically", "honestly", "here's the thing", "look at this", "actually"
- Deictic drivers to connect narration to visuals: "look at this document", "see this number here", "watch what happens when we compare these two"
- Rhetorical questions to engage the viewer: "So why would they do this?", "And what happened next?"
- The tone is: curious, investigative, sometimes frustrated, always intelligent. Think of a documentary narrator who genuinely cares about the topic.
- IMPORTANT: Do NOT write choppy, fragmented sentences. Do NOT make every sentence under 8 words. This should sound like a real person speaking coherently, not a telegram.

HOOK RULES:
1. NO "HI GUYS": Do NOT write "Hey everyone". Start IMMEDIATELY with the hook.
2. NO "IN THIS VIDEO": Don't explain what you'll do. Just DO it.
3. HOST = human: vulnerable, curious, frustrated. A person who discovered something and needs to share it.
4. INTERACTIVITY: Ask the audience to comment/like at a natural emotional peak (not forced).
5. SCREEN TEXT: Key phrases, numbers, and shocking facts should appear as text overlays.
6. NO LONG GOODBYE: Ending <= 3 seconds. Smash cut to black. Leave them thinking.

EVIDENCE LOOP STRUCTURE (repeat throughout):
Context → Deictic Driver ("look at this") → Visual Anchor → Micro-Reveal → But/Therefore Transition

VISUAL LOGIC:
- Pattern Interrupts: change visual type every 15-20 seconds (talking head → document → map → data → B-roll)
- Visual Stun Gun: unexpected visual contrast at key moments
- SFX: paper rustle, whoosh, boom hit, scratch/rewind sound, camera shutter
- Music: ambient drone → driving beat → epic piano → silence (for impact)

ORGANIC TIMING:
- Do NOT use fixed 15-second blocks.
- Vary block lengths naturally: 3s, 45s, 12s, 8s, 30s.
- Hook blocks: short (3-5s). Investigation blocks: longer (20-45s). Transitions: quick (2-5s).

LANGUAGE — ALL IN ENGLISH:
- audioScript: English narration (the spoken word — must sound natural when read aloud)
- russianScript: English screen text / subtitle overlay (key phrases, numbers, quotes that appear on screen)
- visualCue: English production direction for the editor

BLOCK TYPES:
- INTRO: Opening hook, first 60 seconds
- BODY: Main investigation / evidence loop blocks
- TRANSITION: Re-hooks, pattern interrupts, But/Therefore pivots
- SALES: Sponsor integration or CTA (if applicable)
- OUTRO: Final synthesis + smash cut ending

RESPONSE FORMAT — JSON array (MINIMUM 60 objects):
[
  {
    "timecode": "00:00 - 00:05",
    "visualCue": "[HOST] Close-up. Tense expression. Holding a document.",
    "audioScript": "I found something that changes everything we thought we knew about this.",
    "russianScript": "CLASSIFIED — DO NOT DISTRIBUTE",
    "blockType": "INTRO"
  },
  ...
]
"""


# ═══════════════════════════════════════════════════════════════
# GEMINI REST API CLIENT (no SDK — works everywhere)
# ═══════════════════════════════════════════════════════════════

def call_gemini(model_name: str, prompt: str, agent_name: str,
                json_mode: bool = False) -> str:
    """
    Call Gemini REST API with retry and console logging.
    Uses httpx directly — no SDK dependency.
    """
    url = f"{GEMINI_BASE_URL}/models/{model_name}:generateContent"

    body: dict = {
        "contents": [{"parts": [{"text": prompt}]}],
    }
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    last_error = None
    for attempt in range(RETRY_COUNT + 1):
        try:
            retry_msg = f" [attempt {attempt + 1}/{RETRY_COUNT + 1}]" if attempt > 0 else ""
            log(agent_name, f"Gemini API -> {model_name}{retry_msg}")

            start = time.time()
            resp = httpx.post(
                url,
                params={"key": GEMINI_API_KEY},
                json=body,
                timeout=300.0,  # 5 min timeout for Writer agent
            )
            elapsed = time.time() - start

            if resp.status_code != 200:
                error_msg = resp.text[:300]
                raise RuntimeError(f"Gemini API {resp.status_code}: {error_msg}")

            data = resp.json()

            # Extract text from response
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("Gemini returned empty candidates")

            parts = candidates[0].get("content", {}).get("parts", [])
            text = ""
            for part in parts:
                if "text" in part:
                    text += part["text"]

            if not text:
                raise ValueError("Empty text in Gemini response")

            log(agent_name,
                f"{C.GREEN}OK{C.RESET} ({elapsed:.1f}s, {len(text)} chars)")
            return text

        except Exception as e:
            last_error = e
            if attempt < RETRY_COUNT:
                wait = RETRY_BASE_DELAY * (2 ** attempt)
                log("ERROR", f"{agent_name}: {e}")
                log("ERROR", f"Retrying in {wait:.0f}s...")
                time.sleep(wait)
            else:
                log("ERROR", f"{agent_name}: all {RETRY_COUNT + 1} attempts exhausted")

    raise last_error


def call_gemini_image(prompt: str) -> str | None:
    """Generate an image via Gemini REST API."""
    url = f"{GEMINI_BASE_URL}/models/{IMAGE_GEN_MODEL}:generateContent"

    body = {
        "contents": [{"parts": [{"text": f"{IMAGE_PROMPT_PREFIX} {prompt}"}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }

    try:
        resp = httpx.post(
            url,
            params={"key": GEMINI_API_KEY},
            json=body,
            timeout=60.0,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return None

        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData")
            if inline:
                mime = inline.get("mimeType", "image/png")
                b64 = inline.get("data", "")
                return f"data:{mime};base64,{b64}"

        return None
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════
# FASTAPI
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title="Smart Blockbuster API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---

class RadarRequest(BaseModel):
    topic: str

class AnalystRequest(BaseModel):
    topic: str
    radarAnalysis: str

class ArchitectRequest(BaseModel):
    dossier: str

class WriterRequest(BaseModel):
    structure: str
    dossier: str

class ImageRequest(BaseModel):
    prompt: str


# --- Endpoints ---

@app.post("/api/scout")
def scout_endpoint():
    log_separator("AGENT S: SCOUT — Scanning Topics")
    log("SCOUT", "Searching for 4 video topics...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["SCOUT"],
            prompt=AGENT_SCOUT_PROMPT,
            agent_name="SCOUT",
            json_mode=True,
        )
        suggestions = json.loads(text)

        log("SCOUT", f"{C.CYAN}Found {len(suggestions)} topics:{C.RESET}")
        for i, s in enumerate(suggestions, 1):
            log("SCOUT", f"  {i}. {s.get('title', '???')}")
            log("SCOUT", f"     Hook: {s.get('hook', '—')}")
            log("SCOUT", f"     Viral: {s.get('viralFactor', '—')}")

        return suggestions

    except Exception as e:
        log("ERROR", f"Scout failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/radar")
def radar_endpoint(req: RadarRequest):
    log_separator(f"AGENT A: RADAR — \"{req.topic[:50]}\"")
    log("RADAR", f"Topic: {req.topic}")
    log("RADAR", "Analyzing viral angles (Dopamine Ladder)...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["RADAR"],
            prompt=f"TOPIC: {req.topic}\n\n{AGENT_RADAR_PROMPT}",
            agent_name="RADAR",
        )
        preview = text[:200].replace('\n', ' ')
        log("RADAR", f"Preview: {preview}...")
        log("RADAR", f"{C.GREEN}Viral angle analysis complete{C.RESET}")
        return {"result": text}

    except Exception as e:
        log("ERROR", f"Radar failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyst")
def analyst_endpoint(req: AnalystRequest):
    log_separator(f"AGENT B: ANALYST — Dossier \"{req.topic[:50]}\"")
    log("ANALYST", f"Topic: {req.topic}")
    log("ANALYST", f"Radar data: {len(req.radarAnalysis)} chars")
    log("ANALYST", "Two-vector search + Harris visual anchors...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["ANALYST"],
            prompt=f"TOPIC: {req.topic}\n\nRADAR ANALYSIS: {req.radarAnalysis}\n\n{AGENT_ANALYST_PROMPT}",
            agent_name="ANALYST",
            json_mode=True,
        )
        dossier = json.loads(text)

        log("ANALYST", f"  Claims:         {len(dossier.get('claims', []))}")
        log("ANALYST", f"  Counter-claims: {len(dossier.get('counterClaims', []))}")
        log("ANALYST", f"  Visual anchors: {len(dossier.get('visualAnchors', []))}")
        log("ANALYST", f"  Data points:    {len(dossier.get('dataPoints', []))}")
        log("ANALYST", f"{C.GREEN}Dossier compiled{C.RESET}")
        return dossier

    except Exception as e:
        log("ERROR", f"Analyst failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/architect")
def architect_endpoint(req: ArchitectRequest):
    log_separator("AGENT C: ARCHITECT — Video Structure")
    log("ARCHITECT", f"Input dossier: {len(req.dossier)} chars")
    log("ARCHITECT", "Designing Serrated Edge + Hook + But/Therefore...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["ARCHITECT"],
            prompt=f"DOSSIER: {req.dossier}\n\n{AGENT_ARCHITECT_PROMPT}",
            agent_name="ARCHITECT",
        )
        preview = text[:200].replace('\n', ' ')
        log("ARCHITECT", f"Preview: {preview}...")
        log("ARCHITECT", f"{C.GREEN}Structure designed{C.RESET}")
        return {"result": text}

    except Exception as e:
        log("ERROR", f"Architect failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/writer")
def writer_endpoint(req: WriterRequest):
    log_separator("AGENT D: WRITER — Generating A/V Script")
    log("WRITER", f"Structure: {len(req.structure)} chars")
    log("WRITER", f"Dossier: {len(req.dossier)} chars")
    log("WRITER", "Generating 60+ blocks in Staccato style...")
    log("WRITER", f"{C.DIM}(this may take 30-120 seconds){C.RESET}")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["WRITER"],
            prompt=f"DOSSIER: {req.dossier}\nSTRUCTURE: {req.structure}\n\n{AGENT_WRITER_PROMPT}",
            agent_name="WRITER",
            json_mode=True,
        )
        script = json.loads(text)

        word_count = sum(len(b.get("audioScript", "").split()) for b in script)
        log("WRITER", f"  Blocks:    {len(script)}")
        log("WRITER", f"  Words:     {word_count}")

        for i, block in enumerate(script[:3]):
            tc = block.get("timecode", "??:??")
            audio = block.get("audioScript", "")[:60]
            log("WRITER", f"  [{tc}] {audio}...")

        if len(script) > 3:
            log("WRITER", f"  ... and {len(script) - 3} more blocks")

        log("WRITER", f"{C.GREEN}Script generated!{C.RESET}")
        return script

    except Exception as e:
        log("ERROR", f"Writer failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-image")
def image_endpoint(req: ImageRequest):
    log("IMAGE", f"Generating: {req.prompt[:60]}...")

    result = call_gemini_image(req.prompt)
    if result:
        log("IMAGE", f"{C.GREEN}Image generated{C.RESET}")
    else:
        log("IMAGE", "No image found in response")

    return {"imageUrl": result}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini_key": bool(GEMINI_API_KEY),
        "models": AGENT_MODELS,
    }


# ═══════════════════════════════════════════════════════════════
# STARTUP
# ═══════════════════════════════════════════════════════════════

BANNER = f"""
{C.CYAN}{C.BOLD}  ╔═══════════════════════════════════════════════════════════╗
  ║         SMART.BLOCKBUSTER — Backend Server               ║
  ╚═══════════════════════════════════════════════════════════╝{C.RESET}

  {C.DIM}Kalloway + Harris Synthesis Methodology{C.RESET}

  {C.GREEN}Server:{C.RESET}       http://localhost:{PORT}
  {C.GREEN}API:{C.RESET}          http://localhost:{PORT}/api/*
  {C.GREEN}Health:{C.RESET}       http://localhost:{PORT}/api/health
  {C.GREEN}Gemini Key:{C.RESET}   {"OK" if GEMINI_API_KEY else f"{C.RED}NOT SET! Add GEMINI_API_KEY to .env{C.RESET}"}

  {C.DIM}Agents:{C.RESET}
    {C.CYAN}[SCOUT]{C.RESET}     POST /api/scout        {C.DIM}({AGENT_MODELS['SCOUT']}){C.RESET}
    {C.GREEN}[RADAR]{C.RESET}     POST /api/radar        {C.DIM}({AGENT_MODELS['RADAR']}){C.RESET}
    {C.BLUE}[ANALYST]{C.RESET}   POST /api/analyst      {C.DIM}({AGENT_MODELS['ANALYST']}){C.RESET}
    {C.MAGENTA}[ARCHITECT]{C.RESET} POST /api/architect    {C.DIM}({AGENT_MODELS['ARCHITECT']}){C.RESET}
    {C.YELLOW}[WRITER]{C.RESET}    POST /api/writer       {C.DIM}({AGENT_MODELS['WRITER']}){C.RESET}

  {C.DIM}Start frontend: npm run dev{C.RESET}
  {C.DIM}Waiting for requests...{C.RESET}
"""


if __name__ == "__main__":
    print(BANNER)

    if not GEMINI_API_KEY:
        print(f"\n  {C.RED}{C.BOLD}ERROR: GEMINI_API_KEY is not set!{C.RESET}")
        print(f"  Create a .env file in the project root:")
        print(f"")
        print(f"    GEMINI_API_KEY=your_key_from_google_ai_studio")
        print(f"")
        print(f"  Get a key: https://aistudio.google.com/apikey")
        sys.exit(1)

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
