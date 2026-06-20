"""
PAMA MVS Dispatch Module
========================
- POST   /dispatch/instructions       — dispatcher kirim instruksi ke in-cab unit
- GET    /dispatch/instructions       — riwayat (?unit_id=X opsional)
- POST   /dispatch/instructions/{id}/ack  — dipanggil dari in-cab (no auth)
- WS     /ws/incab/{unit_id}          — push instruction ke in-cab (no auth ketat — device token mode)
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth import get_current_user, require_role

DATA_DIR = Path(__file__).parent / "data"
INSTRUCTIONS_FILE = DATA_DIR / "instructions.json"
UNITS_FILE = DATA_DIR / "units.json"

MQTT_INSTRUCTION_TOPIC = "incab/{unit_id}/instruction"

INSTRUCTION_TYPES = {
    "assignment", "waypoint", "digging_point", "dumping_point", "speed_limit", "message",
}

# Required keys per type (untuk validasi payload)
TYPE_SCHEMA = {
    "assignment": ["excavator_id", "dumping_zone"],
    "waypoint": ["coords"],
    "digging_point": ["coord"],
    "dumping_point": ["coord"],
    "speed_limit": ["kmh", "zone_polygon"],
    "message": ["text"],
}


# ============================================================
# File store
# ============================================================

def _read_instructions() -> list[dict]:
    if not INSTRUCTIONS_FILE.exists():
        return []
    try:
        return json.loads(INSTRUCTIONS_FILE.read_text(encoding="utf-8")).get("instructions", [])
    except json.JSONDecodeError:
        return []


def _write_instructions(items: list[dict]):
    INSTRUCTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    INSTRUCTIONS_FILE.write_text(json.dumps({"instructions": items}, indent=2), encoding="utf-8")


def _read_units() -> list[dict]:
    if not UNITS_FILE.exists():
        return []
    try:
        return json.loads(UNITS_FILE.read_text(encoding="utf-8")).get("units", [])
    except json.JSONDecodeError:
        return []


def _find_unit(unit_id: str) -> dict | None:
    return next((u for u in _read_units() if u["id"] == unit_id), None)


# ============================================================
# In-cab WebSocket subscriber registry
# ============================================================

class IncabManager:
    def __init__(self):
        self._subs: dict[str, list] = {}     # unit_id → list[WebSocket]
        self._lock = asyncio.Lock()

    async def register(self, unit_id: str, ws):
        async with self._lock:
            self._subs.setdefault(unit_id, []).append(ws)

    async def unregister(self, unit_id: str, ws):
        async with self._lock:
            if unit_id in self._subs:
                try: self._subs[unit_id].remove(ws)
                except ValueError: pass
                if not self._subs[unit_id]:
                    del self._subs[unit_id]

    async def broadcast(self, unit_id: str, message: dict):
        # Salin list untuk hindari mutasi saat iterasi
        async with self._lock:
            targets = list(self._subs.get(unit_id, []))
        dead = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.unregister(unit_id, ws)


incab_manager = IncabManager()


# ============================================================
# Scope check (dispatcher → site only)
# ============================================================

def _check_unit_scope(user: dict, unit_id: str):
    """Dispatcher hanya boleh kirim ke unit di site-nya. super_admin bypass."""
    unit = _find_unit(unit_id)
    if not unit:
        raise HTTPException(404, f"Unit '{unit_id}' tidak ditemukan di master data")
    if user.get("role") == "super_admin":
        return unit
    if user.get("site") != unit.get("site"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Akses ditolak: Anda dispatcher site {user.get('site')}, "
            f"unit '{unit_id}' di site {unit.get('site')}",
        )
    return unit


# ============================================================
# Pydantic models
# ============================================================

class InstructionCreate(BaseModel):
    unit_id: str
    type: str
    payload: dict
    priority: str = "normal"


class AckBody(BaseModel):
    operator: str | None = None
    note: str | None = None


# ============================================================
# Router (auth-guarded endpoints)
# ============================================================

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


def _mqtt_publish(client, unit_id: str, instruction: dict):
    """Publish MQTT secara fire-and-forget. Kalau client None / offline → skip silent."""
    if client is None:
        return
    try:
        topic = MQTT_INSTRUCTION_TOPIC.format(unit_id=unit_id)
        client.publish(topic, json.dumps(instruction))
    except Exception as e:
        print(f"[dispatch] MQTT publish error: {e}")


# Hook untuk inject MQTT client + main loop dari main.py
_ctx = {"mqtt": None, "loop": None}

def set_context(mqtt_client, loop):
    _ctx["mqtt"] = mqtt_client
    _ctx["loop"] = loop


@router.post("/instructions", status_code=201)
async def create_instruction(
    body: InstructionCreate,
    user: dict = Depends(require_role("super_admin", "roc_dispatcher")),
):
    # Validate type
    if body.type not in INSTRUCTION_TYPES:
        raise HTTPException(400, f"Tipe instruksi invalid: {body.type}. "
                                  f"Allowed: {sorted(INSTRUCTION_TYPES)}")
    # Validate required payload keys
    required = TYPE_SCHEMA.get(body.type, [])
    missing = [k for k in required if k not in body.payload]
    if missing:
        raise HTTPException(400, f"Payload kurang field: {missing}")

    # Site scope check
    _check_unit_scope(user, body.unit_id)

    # Validate priority
    if body.priority not in ("low", "normal", "high"):
        raise HTTPException(400, f"Priority invalid: {body.priority}")

    instruction = {
        "id": str(uuid.uuid4())[:8],
        "ts": time.time(),
        "unit_id": body.unit_id,
        "type": body.type,
        "payload": body.payload,
        "priority": body.priority,
        "sent_by": user.get("username"),
        "status": "sent",
        "ack_at": None,
        "ack_by": None,
    }

    items = _read_instructions()
    items.insert(0, instruction)
    _write_instructions(items[:500])  # cap

    # Publish MQTT (fire-and-forget)
    _mqtt_publish(_ctx["mqtt"], body.unit_id, instruction)

    # Push via WebSocket ke in-cab listeners
    loop = _ctx["loop"]
    if loop is not None:
        asyncio.run_coroutine_threadsafe(
            incab_manager.broadcast(body.unit_id, {"type": "instruction", "data": instruction}),
            loop,
        )

    return instruction


@router.get("/instructions")
async def list_instructions(
    unit_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    items = _read_instructions()
    if unit_id:
        items = [i for i in items if i["unit_id"] == unit_id]
    return items[:limit]


# Endpoint ack TANPA auth (dipanggil dari in-cab device).
# Tidak di-gate karena in-cab MVS tidak punya token user.
@router.post("/instructions/{instruction_id}/ack")
async def ack_instruction(instruction_id: str, body: AckBody | None = None):
    items = _read_instructions()
    idx = next((i for i, x in enumerate(items) if x["id"] == instruction_id), None)
    if idx is None:
        raise HTTPException(404, "Instruction tidak ditemukan")
    items[idx]["status"] = "ack"
    items[idx]["ack_at"] = time.time()
    if body and body.operator:
        items[idx]["ack_by"] = body.operator
    _write_instructions(items)

    # Notify in-cab subscribers (opsional, kalau ada listener lain)
    loop = _ctx["loop"]
    if loop is not None:
        asyncio.run_coroutine_threadsafe(
            incab_manager.broadcast(items[idx]["unit_id"], {"type": "ack", "data": items[idx]}),
            loop,
        )
    return items[idx]
