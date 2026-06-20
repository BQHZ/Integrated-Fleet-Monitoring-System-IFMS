"""
PAMA MVS Admin Module
=====================
CRUD endpoints untuk users / units / geofences + audit log.
Semua require role super_admin (kecuali audit log GET juga super_admin).
Data disimpan di JSON files (MVS — bukan SQLite).
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth import (
    USERS_FILE,
    find_user_by_id,
    hash_password,
    load_users,
    public_user,
    require_role,
)

DATA_DIR = Path(__file__).parent / "data"
UNITS_FILE = DATA_DIR / "units.json"
GEOFENCES_FILE = DATA_DIR / "geofences.json"
AUDIT_FILE = DATA_DIR / "audit_log.json"

AUDIT_MAX_ENTRIES = 1000  # cap supaya file tidak meledak

_file_lock = threading.Lock()


# ============================================================
# JSON store helpers
# ============================================================

def _read(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _seed_units():
    if UNITS_FILE.exists():
        return
    # [ASUMSI] seed selaras dengan simulator/simulator.py build_fleet()
    units = [
        {"id": "DT-A01", "unit_type": "haul_truck", "site": "MTBU", "model": "HD785-7", "capacity_ton": 91, "commissioning_date": "2022-03-15"},
        {"id": "DT-A02", "unit_type": "haul_truck", "site": "MTBU", "model": "HD785-7", "capacity_ton": 91, "commissioning_date": "2022-04-02"},
        {"id": "DT-A03", "unit_type": "haul_truck", "site": "MTBU", "model": "HD785-7", "capacity_ton": 91, "commissioning_date": "2022-05-20"},
        {"id": "EX-A01", "unit_type": "excavator", "site": "MTBU", "model": "PC2000-8", "capacity_ton": 12, "commissioning_date": "2021-08-10"},
        {"id": "DZ-A01", "unit_type": "dozer", "site": "MTBU", "model": "D375A-6", "capacity_ton": None, "commissioning_date": "2021-12-01"},
        {"id": "GR-A01", "unit_type": "grader", "site": "MTBU", "model": "GD825A-2", "capacity_ton": None, "commissioning_date": "2022-01-15"},
        {"id": "DT-B01", "unit_type": "haul_truck", "site": "ADRO", "model": "HD785-7", "capacity_ton": 91, "commissioning_date": "2022-06-10"},
        {"id": "DT-B02", "unit_type": "haul_truck", "site": "ADRO", "model": "HD785-7", "capacity_ton": 91, "commissioning_date": "2022-07-22"},
        {"id": "EX-B01", "unit_type": "excavator", "site": "ADRO", "model": "PC2000-8", "capacity_ton": 12, "commissioning_date": "2021-11-05"},
        {"id": "WT-B01", "unit_type": "water_truck", "site": "ADRO", "model": "HD465-7", "capacity_ton": 30, "commissioning_date": "2022-02-18"},
        {"id": "ST-B01", "unit_type": "service_truck", "site": "ADRO", "model": "HD405-7", "capacity_ton": 15, "commissioning_date": "2022-08-30"},
    ]
    _write(UNITS_FILE, {"units": units})


def _seed_geofences():
    if GEOFENCES_FILE.exists():
        return
    # [ASUMSI] seed dari koordinat pit/no-go yang dipakai simulator
    geofences = [
        {
            "id": "GF-001", "site": "MTBU", "type": "digging", "name": "Loading Point North",
            "polygon": [[-3.5760, 115.6020], [-3.5760, 115.6040], [-3.5780, 115.6040], [-3.5780, 115.6020]],
            "speed_limit": 15,
        },
        {
            "id": "GF-002", "site": "MTBU", "type": "dumping", "name": "Dump Point West",
            "polygon": [[-3.5825, 115.5945], [-3.5825, 115.5960], [-3.5840, 115.5960], [-3.5840, 115.5945]],
            "speed_limit": 15,
        },
        {
            "id": "GF-003", "site": "MTBU", "type": "restricted", "name": "Blast Area North",
            "polygon": [[-3.5755, 115.6025], [-3.5755, 115.6035], [-3.5770, 115.6035], [-3.5770, 115.6025]],
            "speed_limit": None,
        },
        {
            "id": "GF-004", "site": "ADRO", "type": "digging", "name": "Loading Point South",
            "polygon": [[-2.1760, 115.2415], [-2.1760, 115.2430], [-2.1775, 115.2430], [-2.1775, 115.2415]],
            "speed_limit": 15,
        },
    ]
    _write(GEOFENCES_FILE, {"geofences": geofences})


def _seed_audit():
    if not AUDIT_FILE.exists():
        _write(AUDIT_FILE, {"entries": []})


def ensure_seed():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _seed_units()
    _seed_geofences()
    _seed_audit()


# ============================================================
# Audit log
# ============================================================

def _scrub(d: dict | None) -> dict | None:
    """Buang password_hash dari snapshot audit."""
    if d is None:
        return None
    out = dict(d)
    out.pop("password_hash", None)
    return out


def audit(user: dict, action: str, entity: str, before: dict | None, after: dict | None) -> dict:
    with _file_lock:
        data = _read(AUDIT_FILE, {"entries": []})
        entry = {
            "id": str(uuid.uuid4())[:8],
            "ts": time.time(),
            "user": user.get("username") if user else "system",
            "action": action,
            "entity": entity,
            "before": _scrub(before),
            "after": _scrub(after),
        }
        entries = data.get("entries", [])
        entries.insert(0, entry)
        # Cap
        data["entries"] = entries[:AUDIT_MAX_ENTRIES]
        _write(AUDIT_FILE, data)
        return entry


# ============================================================
# Router
# ============================================================

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("super_admin"))],
)


# -------- Users --------

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=4)
    role: str
    site: str | None = None
    name: str

class UserUpdate(BaseModel):
    role: str | None = None
    site: str | None = None
    name: str | None = None
    disabled: bool | None = None
    password: str | None = None  # kalau diisi = reset password


def _users_data() -> list[dict]:
    return load_users()


def _users_write(users: list[dict]):
    _write(USERS_FILE, {"users": users})


@router.get("/users")
def admin_list_users(user: dict = Depends(require_role("super_admin"))):
    return [
        {**public_user(u), "disabled": bool(u.get("disabled", False))}
        for u in _users_data()
    ]


@router.post("/users", status_code=201)
def admin_create_user(body: UserCreate, user: dict = Depends(require_role("super_admin"))):
    if body.role not in ("super_admin", "roc_dispatcher"):
        raise HTTPException(400, f"Role tidak valid: {body.role}")
    users = _users_data()
    if any(u["username"] == body.username for u in users):
        raise HTTPException(409, f"Username '{body.username}' sudah dipakai")
    new_id = f"u{int(time.time()*1000)}"
    new = {
        "id": new_id,
        "username": body.username,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "site": body.site,
        "name": body.name,
        "disabled": False,
    }
    users.append(new)
    _users_write(users)
    audit(user, "create", f"user:{new_id}", None, new)
    return {**public_user(new), "disabled": False}


@router.patch("/users/{user_id}")
def admin_update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_role("super_admin"))):
    users = _users_data()
    idx = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
    if idx is None:
        raise HTTPException(404, "User tidak ditemukan")
    before = dict(users[idx])
    target = users[idx]
    if body.role is not None:
        if body.role not in ("super_admin", "roc_dispatcher"):
            raise HTTPException(400, f"Role tidak valid: {body.role}")
        target["role"] = body.role
    if body.site is not None:
        target["site"] = body.site or None
    if body.name is not None:
        target["name"] = body.name
    if body.disabled is not None:
        target["disabled"] = body.disabled
    if body.password is not None:
        target["password_hash"] = hash_password(body.password)
    _users_write(users)
    audit(user, "update", f"user:{user_id}", before, target)
    return {**public_user(target), "disabled": bool(target.get("disabled", False))}


@router.delete("/users/{user_id}")
def admin_delete_user(user_id: str, user: dict = Depends(require_role("super_admin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak bisa hapus user diri sendiri")
    users = _users_data()
    idx = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
    if idx is None:
        raise HTTPException(404, "User tidak ditemukan")
    removed = users.pop(idx)
    _users_write(users)
    audit(user, "delete", f"user:{user_id}", removed, None)
    return {"deleted": user_id}


# -------- Units --------

class UnitBody(BaseModel):
    id: str
    unit_type: str
    site: str
    model: str | None = None
    capacity_ton: float | None = None
    commissioning_date: str | None = None


@router.get("/units")
def admin_list_units(user: dict = Depends(require_role("super_admin"))):
    return _read(UNITS_FILE, {"units": []}).get("units", [])


@router.post("/units", status_code=201)
def admin_create_unit(body: UnitBody, user: dict = Depends(require_role("super_admin"))):
    data = _read(UNITS_FILE, {"units": []})
    units = data.get("units", [])
    if any(u["id"] == body.id for u in units):
        raise HTTPException(409, f"Unit ID '{body.id}' sudah ada")
    new = body.model_dump()
    units.append(new)
    _write(UNITS_FILE, {"units": units})
    audit(user, "create", f"unit:{body.id}", None, new)
    return new


@router.patch("/units/{unit_id}")
def admin_update_unit(unit_id: str, body: UnitBody, user: dict = Depends(require_role("super_admin"))):
    data = _read(UNITS_FILE, {"units": []})
    units = data.get("units", [])
    idx = next((i for i, u in enumerate(units) if u["id"] == unit_id), None)
    if idx is None:
        raise HTTPException(404, "Unit tidak ditemukan")
    before = dict(units[idx])
    new = body.model_dump()
    units[idx] = new
    _write(UNITS_FILE, {"units": units})
    audit(user, "update", f"unit:{unit_id}", before, new)
    return new


@router.delete("/units/{unit_id}")
def admin_delete_unit(unit_id: str, user: dict = Depends(require_role("super_admin"))):
    data = _read(UNITS_FILE, {"units": []})
    units = data.get("units", [])
    idx = next((i for i, u in enumerate(units) if u["id"] == unit_id), None)
    if idx is None:
        raise HTTPException(404, "Unit tidak ditemukan")
    removed = units.pop(idx)
    _write(UNITS_FILE, {"units": units})
    audit(user, "delete", f"unit:{unit_id}", removed, None)
    return {"deleted": unit_id}


# -------- Geofences --------

GEOFENCE_TYPES = {"digging", "dumping", "restricted", "fuel", "workshop", "speed"}


class GeofenceBody(BaseModel):
    id: str | None = None
    site: str
    type: str
    name: str | None = None
    polygon: list[list[float]]  # [[lat, lon], ...]
    speed_limit: float | None = None


def _validate_geofence(body: GeofenceBody):
    if body.type not in GEOFENCE_TYPES:
        raise HTTPException(400, f"Type harus salah satu: {sorted(GEOFENCE_TYPES)}")
    if not isinstance(body.polygon, list) or len(body.polygon) < 3:
        raise HTTPException(400, "Polygon harus list of [lat, lon] minimal 3 titik")
    for p in body.polygon:
        if not (isinstance(p, list) and len(p) == 2 and all(isinstance(c, (int, float)) for c in p)):
            raise HTTPException(400, f"Titik polygon invalid: {p}")


@router.get("/geofences")
def admin_list_geofences(user: dict = Depends(require_role("super_admin"))):
    return _read(GEOFENCES_FILE, {"geofences": []}).get("geofences", [])


@router.post("/geofences", status_code=201)
def admin_create_geofence(body: GeofenceBody, user: dict = Depends(require_role("super_admin"))):
    _validate_geofence(body)
    data = _read(GEOFENCES_FILE, {"geofences": []})
    fences = data.get("geofences", [])
    new_id = body.id or f"GF-{int(time.time()*1000) % 100000:05d}"
    if any(f["id"] == new_id for f in fences):
        raise HTTPException(409, f"Geofence ID '{new_id}' sudah ada")
    new = body.model_dump()
    new["id"] = new_id
    fences.append(new)
    _write(GEOFENCES_FILE, {"geofences": fences})
    audit(user, "create", f"geofence:{new_id}", None, new)
    return new


@router.patch("/geofences/{gf_id}")
def admin_update_geofence(gf_id: str, body: GeofenceBody, user: dict = Depends(require_role("super_admin"))):
    _validate_geofence(body)
    data = _read(GEOFENCES_FILE, {"geofences": []})
    fences = data.get("geofences", [])
    idx = next((i for i, f in enumerate(fences) if f["id"] == gf_id), None)
    if idx is None:
        raise HTTPException(404, "Geofence tidak ditemukan")
    before = dict(fences[idx])
    new = body.model_dump()
    new["id"] = gf_id
    fences[idx] = new
    _write(GEOFENCES_FILE, {"geofences": fences})
    audit(user, "update", f"geofence:{gf_id}", before, new)
    return new


@router.delete("/geofences/{gf_id}")
def admin_delete_geofence(gf_id: str, user: dict = Depends(require_role("super_admin"))):
    data = _read(GEOFENCES_FILE, {"geofences": []})
    fences = data.get("geofences", [])
    idx = next((i for i, f in enumerate(fences) if f["id"] == gf_id), None)
    if idx is None:
        raise HTTPException(404, "Geofence tidak ditemukan")
    removed = fences.pop(idx)
    _write(GEOFENCES_FILE, {"geofences": fences})
    audit(user, "delete", f"geofence:{gf_id}", removed, None)
    return {"deleted": gf_id}


# -------- Audit log --------

@router.get("/audit-log")
def admin_audit_log(
    limit: int = Query(100, ge=1, le=AUDIT_MAX_ENTRIES),
    user_filter: str | None = Query(None, alias="user"),
    action: str | None = None,
    user: dict = Depends(require_role("super_admin")),
):
    data = _read(AUDIT_FILE, {"entries": []})
    entries = data.get("entries", [])
    if user_filter:
        entries = [e for e in entries if e.get("user") == user_filter]
    if action:
        entries = [e for e in entries if e.get("action") == action]
    return entries[:limit]
