"""
PAMA Fleet Backend — v3
========================
Endpoints:
  WebSocket /ws                      — realtime broadcast
  GET /api/fleet                     — all units snapshot
  GET /api/metrics                   — overall metrics
  GET /api/metrics/by-site
  GET /api/alerts
  GET /api/dispatch
  GET /api/guidance/{unit_id}
  GET /api/units
  GET /api/incab/{unit_id}           — full in-cab data per unit_type
  GET /api/roc/production-kpi
  GET /api/roc/payload-analysis
  GET /api/roc/cycle-breakdown
  GET /api/roc/dispatch-matrix
  GET /api/roc/safety-events
  GET /api/roc/maintenance-health
  GET /api/roc/shift-summary
  GET /api/roc/cross-site-benchmark
"""

import asyncio
import json
import math
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, asdict, field
from datetime import datetime

import paho.mqtt.client as mqtt
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError
from pydantic import BaseModel

from auth import (
    create_access_token,
    decode_token,
    find_user_by_username,
    get_current_user,
    public_user,
    validate_ws_token,
    verify_password,
)
from admin import router as admin_router, ensure_seed
from dispatch import router as dispatch_router, incab_manager, set_context as set_dispatch_context

MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_FILTER = "pama/fleet/#"

# [ASUMSI] Konstanta operasional
ASSUMED_BCM_PER_CYCLE = 18.0
ASSUMED_COST_PER_HOUR_USD = 45.0
ASSUMED_TARGET_BCM_SHIFT = 2500.0
ASSUMED_SERVICE_INTERVAL_HOURS = 250

SITE_WAYPOINTS = {
    "siteA": {
        "loading_lat": -3.5800 + 0.004, "loading_lon": 115.6000 + 0.002,
        "dumping_lat": -3.5800 - 0.003, "dumping_lon": 115.6000 - 0.005,
    },
    "siteB": {
        "loading_lat": -2.1800 + 0.004, "loading_lon": 115.2400 + 0.002,
        "dumping_lat": -2.1800 - 0.003, "dumping_lon": 115.2400 - 0.005,
    },
}


@dataclass
class UnitState:
    unit_id: str
    site_id: str
    unit_type: str = "haul_truck"
    lat: float = 0.0
    lon: float = 0.0
    status: str = "unknown"
    fuel_level_pct: float = 0.0
    engine_hours: float = 0.0
    cycle_count: int = 0
    idle_seconds_this_cycle: float = 0.0
    fault_code: str | None = None
    last_update: float = field(default_factory=time.time)
    status_seconds: dict = field(default_factory=lambda: defaultdict(float))
    payload_samples: deque = field(default_factory=lambda: deque(maxlen=40))
    # haul truck fields
    payload_ton: float = 0.0
    current_speed_kmh: float = 0.0
    speed_limit_kmh: float = 40.0
    road_segment: str = "haul_road_main"
    speed_violation: dict = field(default_factory=lambda: {"violated": False, "excess_kmh": 0})
    harsh_brake_event: dict = field(default_factory=lambda: {"detected": False, "deceleration_g": 0.0})
    no_go_proximity: dict = field(default_factory=lambda: {"in_zone": False, "zone_name": None, "distance_m": None})
    fatigue_alert: bool = False
    last_proximity_event: float = 0.0
    # excavator fields
    bucket_swings: int | None = None
    dig_rate_bcm_hr: float | None = None
    hydraulic_pressure_bar: float | None = None
    trucks_served_shift: int | None = None
    queue_depth: int | None = None
    idle_waiting_seconds: float | None = None
    # dozer fields
    push_cycles: int | None = None
    material_moved_bcm: float | None = None
    blade_load_pct: float | None = None
    # water truck fields
    tank_level_pct: float | None = None
    spray_rate_l_min: float | None = None
    km_covered_shift: float | None = None
    current_road_segment: str | None = None
    # grader fields
    pass_count_shift: int | None = None
    passes_on_segment: int | None = None
    cross_slope_pct: float | None = None
    road_condition_score: float | None = None
    grader_segment: str | None = None
    # service truck fields
    fuel_delivered_l_shift: float | None = None
    units_serviced_shift: int | None = None
    assignment_unit: str | None = None
    assignment_task: str | None = None
    assignment_location: str | None = None
    # shared
    coolant_temp_c: float = 85.0
    oil_pressure_bar: float = 4.2
    engine_load_pct: float = 50.0
    shift_hours_worked: float = 0.0


class FleetStore:
    def __init__(self):
        self.units: dict[str, UnitState] = {}
        self.alerts: deque = deque(maxlen=30)
        self.safety_events: deque = deque(maxlen=50)
        self.dispatch_overrides: deque = deque(maxlen=50)
        self._lock = asyncio.Lock()
        self._start_time = time.time()

    def update_from_payload(self, payload: dict):
        uid = payload["unit_id"]
        now = time.time()

        if uid not in self.units:
            self.units[uid] = UnitState(
                unit_id=uid,
                site_id=payload["site_id"],
                unit_type=payload.get("unit_type", "haul_truck"),
            )

        unit = self.units[uid]
        elapsed = now - unit.last_update if unit.last_update else 0

        if 0 < elapsed < 30:
            unit.status_seconds[unit.status] = unit.status_seconds.get(unit.status, 0) + elapsed

        unit.lat = payload["lat"]
        unit.lon = payload["lon"]
        unit.status = payload["status"]
        unit.fuel_level_pct = payload["fuel_level_pct"]
        unit.engine_hours = payload["engine_hours"]
        unit.cycle_count = payload.get("cycle_count", 0)
        unit.idle_seconds_this_cycle = payload.get("idle_seconds_this_cycle", 0)
        unit.unit_type = payload.get("unit_type", unit.unit_type)
        unit.coolant_temp_c = payload.get("coolant_temp_c", unit.coolant_temp_c)
        unit.oil_pressure_bar = payload.get("oil_pressure_bar", unit.oil_pressure_bar)
        unit.engine_load_pct = payload.get("engine_load_pct", unit.engine_load_pct)
        unit.shift_hours_worked = payload.get("shift_hours_worked", unit.shift_hours_worked)
        unit.last_update = now

        # haul truck
        if payload.get("payload_ton") is not None:
            new_pt = payload["payload_ton"]
            # Sample baru saat transisi dari 0 → >0 (truk selesai diisi)
            if new_pt > 0 and unit.payload_ton == 0:
                unit.payload_samples.append(new_pt)
            unit.payload_ton = new_pt
        if payload.get("current_speed_kmh") is not None:
            unit.current_speed_kmh = payload["current_speed_kmh"]
        if payload.get("speed_limit_kmh") is not None:
            unit.speed_limit_kmh = payload["speed_limit_kmh"]
        if payload.get("road_segment") is not None:
            unit.road_segment = payload["road_segment"]
        if payload.get("speed_violation") is not None:
            unit.speed_violation = payload["speed_violation"]
        if payload.get("harsh_brake_event") is not None:
            unit.harsh_brake_event = payload["harsh_brake_event"]
        if payload.get("no_go_proximity") is not None:
            unit.no_go_proximity = payload["no_go_proximity"]

        # excavator
        if payload.get("bucket_swings") is not None:
            unit.bucket_swings = payload["bucket_swings"]
        if payload.get("dig_rate_bcm_hr") is not None:
            unit.dig_rate_bcm_hr = payload["dig_rate_bcm_hr"]
        if payload.get("hydraulic_pressure_bar") is not None:
            unit.hydraulic_pressure_bar = payload["hydraulic_pressure_bar"]
        if payload.get("trucks_served_shift") is not None:
            unit.trucks_served_shift = payload["trucks_served_shift"]
        if payload.get("queue_depth") is not None:
            unit.queue_depth = payload["queue_depth"]
        if payload.get("idle_waiting_seconds") is not None:
            unit.idle_waiting_seconds = payload["idle_waiting_seconds"]

        # dozer
        if payload.get("push_cycles") is not None:
            unit.push_cycles = payload["push_cycles"]
        if payload.get("material_moved_bcm") is not None:
            unit.material_moved_bcm = payload["material_moved_bcm"]
        if payload.get("blade_load_pct") is not None:
            unit.blade_load_pct = payload["blade_load_pct"]

        # water truck
        if payload.get("tank_level_pct") is not None:
            unit.tank_level_pct = payload["tank_level_pct"]
        if payload.get("spray_rate_l_min") is not None:
            unit.spray_rate_l_min = payload["spray_rate_l_min"]
        if payload.get("km_covered_shift") is not None:
            unit.km_covered_shift = payload["km_covered_shift"]
        if payload.get("current_road_segment") is not None:
            unit.current_road_segment = payload["current_road_segment"]

        # grader
        for k in ("pass_count_shift", "passes_on_segment", "cross_slope_pct",
                  "road_condition_score", "grader_segment"):
            if payload.get(k) is not None:
                setattr(unit, k, payload[k])

        # service truck
        for k in ("fuel_delivered_l_shift", "units_serviced_shift",
                  "assignment_unit", "assignment_task", "assignment_location"):
            if payload.get(k) is not None:
                setattr(unit, k, payload[k])

        # Fault handling
        new_fault = payload.get("fault_code")
        if new_fault and new_fault != unit.fault_code:
            self._raise_alert(uid, "fault", f"FAULT pada {uid}: {new_fault}")
            self._raise_safety_event(uid, unit.site_id, "fault", "high",
                                     f"Fault code {new_fault} terdeteksi pada {uid}")
        unit.fault_code = new_fault

        # Idle alert
        if unit.idle_seconds_this_cycle >= 60 and unit.status == "idle":
            if int(unit.idle_seconds_this_cycle) % 60 < 5:
                self._raise_alert(uid, "idle", f"{uid} idle {int(unit.idle_seconds_this_cycle)}s")

        # Fuel low
        if unit.fuel_level_pct < 20:
            self._raise_alert(uid, "fuel_low", f"{uid} fuel {unit.fuel_level_pct:.0f}% — refuel")

        # Speed violation
        if unit.speed_violation and unit.speed_violation.get("violated"):
            self._raise_safety_event(uid, unit.site_id, "speed_violation", "medium",
                                     f"{uid} overspeeding +{unit.speed_violation['excess_kmh']}km/h di {unit.road_segment}")

        # Coolant high
        if unit.coolant_temp_c > 100:
            self._raise_safety_event(uid, unit.site_id, "coolant_high", "medium",
                                     f"{uid} coolant temp {unit.coolant_temp_c:.1f}°C — di atas normal")

        # Harsh brake event (dari MPU6050 / simulator proxy)
        hb = unit.harsh_brake_event or {}
        if hb.get("detected"):
            decel = hb.get("deceleration_g", 0)
            sev = "high" if decel > 0.6 else "medium"
            self._raise_safety_event(uid, unit.site_id, "harsh_brake", sev,
                                     f"{uid} harsh brake terdeteksi — deselerasi {decel}g")

        # No-go zone proximity
        ng = unit.no_go_proximity or {}
        if ng.get("in_zone"):
            self._raise_safety_event(uid, unit.site_id, "no_go_zone", "high",
                                     f"{uid} memasuki No-Go Zone '{ng.get('zone_name')}' (jarak {ng.get('distance_m')}m)")

        # Fatigue: shift_hours_worked > 7 jam consecutive [ASUMSI threshold]
        prev_fatigue = unit.fatigue_alert
        unit.fatigue_alert = unit.shift_hours_worked > 7.0
        if unit.fatigue_alert and not prev_fatigue:
            self._raise_safety_event(uid, unit.site_id, "fatigue", "medium",
                                     f"{uid} operator fatigue alert — {unit.shift_hours_worked:.1f}h consecutive [ASUMSI]")

        # Near-miss proximity check
        self._check_near_miss(unit)

    def _check_near_miss(self, unit: UnitState):
        """Scan haul truck lain di site sama; jarak < 30m → near-miss event (throttled)."""
        if unit.unit_type != "haul_truck":
            return
        NEAR_MISS_THRESHOLD_M = 30
        THROTTLE_SECONDS = 60
        now = time.time()
        for other in self.units.values():
            if other.unit_id == unit.unit_id or other.unit_type != "haul_truck":
                continue
            if other.site_id != unit.site_id:
                continue
            if now - other.last_update > 15:
                continue
            dlat = (unit.lat - other.lat) * 111000
            dlon = (unit.lon - other.lon) * 111000 * 0.85
            dist_m = (dlat ** 2 + dlon ** 2) ** 0.5
            if dist_m < NEAR_MISS_THRESHOLD_M:
                if now - unit.last_proximity_event > THROTTLE_SECONDS:
                    self._raise_safety_event(
                        unit.unit_id, unit.site_id, "near_miss", "high",
                        f"Near-miss: {unit.unit_id} ↔ {other.unit_id} jarak {dist_m:.0f}m",
                    )
                    unit.last_proximity_event = now
                    other.last_proximity_event = now
                break

    def _raise_alert(self, unit_id: str, kind: str, message: str):
        self.alerts.appendleft({
            "unit_id": unit_id,
            "kind": kind,
            "message": message,
            "timestamp": time.time(),
        })

    def _raise_safety_event(self, unit_id: str, site_id: str, event_type: str, severity: str, message: str):
        self.safety_events.appendleft({
            "event_id": str(uuid.uuid4())[:8],
            "unit_id": unit_id,
            "site_id": site_id,
            "event_type": event_type,
            "severity": severity,
            "message": message,
            "timestamp": time.time(),
        })

    def snapshot(self) -> list[dict]:
        result = []
        for u in self.units.values():
            d = u.__dict__.copy()
            d["status_seconds"] = dict(d.get("status_seconds", {}))
            d.pop("payload_samples", None)  # deque tidak perlu di-broadcast tiap update
            result.append(d)
        return result

    def metrics_overall(self) -> dict:
        return self._compute_metrics(self.units.values())

    def metrics_by_site(self) -> dict:
        sites: dict[str, list] = defaultdict(list)
        for u in self.units.values():
            sites[u.site_id].append(u)
        return {sid: self._compute_metrics(units) for sid, units in sites.items()}

    def _compute_metrics(self, units) -> dict:
        units = list(units)
        if not units:
            return {"utilization_pct": 0, "idle_pct": 0, "total_cycles": 0,
                    "active_units": 0, "proxy_usd_per_bcm": None, "total_bcm_moved": 0}

        total_active = total_idle = total_cycles = 0
        for u in units:
            secs = dict(u.status_seconds)
            idle_s = secs.get("idle", 0) + secs.get("waiting_truck", 0)
            active_s = sum(v for k, v in secs.items() if k not in ("idle", "waiting_truck"))
            total_active += active_s
            total_idle += idle_s
            total_cycles += u.cycle_count

        total_time = total_active + total_idle
        utilization_pct = (total_active / total_time * 100) if total_time > 0 else 0
        idle_pct = (total_idle / total_time * 100) if total_time > 0 else 0

        total_hours = total_time / 3600
        total_bcm = total_cycles * ASSUMED_BCM_PER_CYCLE
        total_cost = total_hours * len(units) * ASSUMED_COST_PER_HOUR_USD
        proxy = (total_cost / total_bcm) if total_bcm > 0 else None

        return {
            "utilization_pct": round(utilization_pct, 1),
            "idle_pct": round(idle_pct, 1),
            "total_cycles": total_cycles,
            "active_units": len(units),
            "proxy_usd_per_bcm": round(proxy, 2) if proxy else None,
            "total_bcm_moved": round(total_bcm, 1),
        }

    def dispatch_suggestions(self) -> list[dict]:
        suggestions = []
        idle_units = [u for u in self.units.values()
                      if u.status in ("idle", "hauling_empty") and u.idle_seconds_this_cycle > 30]
        for unit in idle_units:
            suggestions.append({
                "unit_id": unit.unit_id,
                "site_id": unit.site_id,
                "idle_seconds": unit.idle_seconds_this_cycle,
                "suggestion": f"Pindahkan {unit.unit_id} ke Loading Point — idle {int(unit.idle_seconds_this_cycle)}s",
                "priority": "high" if unit.idle_seconds_this_cycle > 120 else "medium",
            })
        return sorted(suggestions, key=lambda x: x["idle_seconds"], reverse=True)

    def guidance_for_unit(self, unit_id: str) -> dict | None:
        unit = self.units.get(unit_id)
        if not unit:
            return None
        waypoints = SITE_WAYPOINTS.get(unit.site_id, {})
        if unit.status in ("hauling_loaded", "dumping"):
            target_lat = waypoints.get("dumping_lat")
            target_lon = waypoints.get("dumping_lon")
            target_label = "Dumping Point"
        else:
            target_lat = waypoints.get("loading_lat")
            target_lon = waypoints.get("loading_lon")
            target_label = "Loading Point"

        dist_m = None
        if target_lat and target_lon:
            dlat = abs(unit.lat - target_lat) * 111000
            dlon = abs(unit.lon - target_lon) * 111000 * 0.85
            dist_m = round((dlat**2 + dlon**2)**0.5)

        secs = dict(unit.status_seconds)
        idle_s = secs.get("idle", 0)
        active_s = sum(v for k, v in secs.items() if k != "idle")
        total_s = idle_s + active_s
        utilization = (active_s / total_s * 100) if total_s > 0 else 0
        score = min(100, round(utilization * 0.7 + unit.cycle_count * 2))

        return {
            "unit_id": unit_id,
            "unit_type": unit.unit_type,
            "site_id": unit.site_id,
            "status": unit.status,
            "lat": unit.lat,
            "lon": unit.lon,
            "fuel_level_pct": unit.fuel_level_pct,
            "cycle_count": unit.cycle_count,
            "idle_seconds": unit.idle_seconds_this_cycle,
            "fault_code": unit.fault_code,
            "target_label": target_label,
            "target_lat": target_lat,
            "target_lon": target_lon,
            "distance_to_target_m": dist_m,
            "operator_score": score,
            "utilization_pct": round(utilization, 1),
            "alerts": [a for a in list(self.alerts) if a["unit_id"] == unit_id][:5],
        }

    def incab_data(self, unit_id: str) -> dict | None:
        unit = self.units.get(unit_id)
        if not unit:
            return None

        guidance = self.guidance_for_unit(unit_id) or {}
        base = {
            "unit_id": unit_id,
            "unit_type": unit.unit_type,
            "site_id": unit.site_id,
            "status": unit.status,
            "lat": unit.lat,
            "lon": unit.lon,
            "fuel_level_pct": unit.fuel_level_pct,
            "engine_hours": unit.engine_hours,
            "cycle_count": unit.cycle_count,
            "idle_seconds": unit.idle_seconds_this_cycle,
            "fault_code": unit.fault_code,
            "coolant_temp_c": unit.coolant_temp_c,
            "oil_pressure_bar": unit.oil_pressure_bar,
            "engine_load_pct": unit.engine_load_pct,
            "shift_hours_worked": unit.shift_hours_worked,
            "target_label": guidance.get("target_label"),
            "target_lat": guidance.get("target_lat"),
            "target_lon": guidance.get("target_lon"),
            "distance_to_target_m": guidance.get("distance_to_target_m"),
            "operator_score": guidance.get("operator_score"),
            "utilization_pct": guidance.get("utilization_pct"),
            "alerts": [a for a in list(self.alerts) if a["unit_id"] == unit_id][:5],
            # haul truck
            "payload_ton": unit.payload_ton,
            "current_speed_kmh": unit.current_speed_kmh,
            "speed_limit_kmh": unit.speed_limit_kmh,
            "speed_violation": unit.speed_violation,
            "road_segment": unit.road_segment,
            # excavator
            "bucket_swings": unit.bucket_swings,
            "dig_rate_bcm_hr": unit.dig_rate_bcm_hr,
            "hydraulic_pressure_bar": unit.hydraulic_pressure_bar,
            "trucks_served_shift": unit.trucks_served_shift,
            "queue_depth": unit.queue_depth,
            "idle_waiting_seconds": unit.idle_waiting_seconds,
            # dozer
            "push_cycles": unit.push_cycles,
            "material_moved_bcm": unit.material_moved_bcm,
            "blade_load_pct": unit.blade_load_pct,
            # water truck
            "tank_level_pct": unit.tank_level_pct,
            "spray_rate_l_min": unit.spray_rate_l_min,
            "km_covered_shift": unit.km_covered_shift,
            "current_road_segment": unit.current_road_segment,
            # grader
            "pass_count_shift": unit.pass_count_shift,
            "passes_on_segment": unit.passes_on_segment,
            "cross_slope_pct": unit.cross_slope_pct,
            "road_condition_score": unit.road_condition_score,
            "grader_segment": unit.grader_segment,
            # service truck
            "fuel_delivered_l_shift": unit.fuel_delivered_l_shift,
            "units_serviced_shift": unit.units_serviced_shift,
            "assignment_unit": unit.assignment_unit,
            "assignment_task": unit.assignment_task,
            "assignment_location": unit.assignment_location,
        }
        return base

    def production_kpi(self) -> dict:
        haul_trucks = [u for u in self.units.values() if u.unit_type == "haul_truck"]
        total_cycles = sum(u.cycle_count for u in haul_trucks)
        total_bcm = total_cycles * ASSUMED_BCM_PER_CYCLE  # [ASUMSI]
        elapsed_hours = (time.time() - self._start_time) / 3600
        bcm_per_hour = (total_bcm / elapsed_hours) if elapsed_hours > 0 else 0

        overall = self.metrics_overall()
        units_without_fault = [u for u in self.units.values() if not u.fault_code]
        availability = (len(units_without_fault) / len(self.units) * 100) if self.units else 0
        utilization = overall.get("utilization_pct", 0)
        uoa = (utilization / availability * 100) if availability > 0 else 0

        return {
            "total_bcm_shift": round(total_bcm, 1),
            "bcm_per_hour": round(bcm_per_hour, 1),
            "target_bcm_shift": ASSUMED_TARGET_BCM_SHIFT,
            "target_bcm_per_hour": round(ASSUMED_TARGET_BCM_SHIFT / 8, 1),
            "fleet_utilization_pct": utilization,
            "fleet_availability_pct": round(availability, 1),
            "uoa_pct": round(min(uoa, 100), 1),
            "total_cycles": total_cycles,
            "active_haul_trucks": len([u for u in haul_trucks if u.status not in ("idle",)]),
            "shift_elapsed_hours": round(elapsed_hours, 2),
        }

    def payload_analysis(self) -> list[dict]:
        result = []
        for u in self.units.values():
            if u.unit_type != "haul_truck":
                continue
            pt = u.payload_ton or 0
            if pt < 90:
                category = "underload"
            elif pt <= 120:
                category = "nominal"
            else:
                category = "overload"
            result.append({
                "unit_id": u.unit_id,
                "site_id": u.site_id,
                "current_payload_ton": round(pt, 1),
                "category": category,  # [ASUMSI] threshold 90-120t
            })
        return result

    def cycle_breakdown(self) -> list[dict]:
        result = []
        for u in self.units.values():
            if u.unit_type != "haul_truck":
                continue
            secs = dict(u.status_seconds)
            result.append({
                "unit_id": u.unit_id,
                "site_id": u.site_id,
                "loading_time_s": round(secs.get("loading", 0)),
                "haul_loaded_time_s": round(secs.get("hauling_loaded", 0)),
                "dump_time_s": round(secs.get("dumping", 0)),
                "return_time_s": round(secs.get("hauling_empty", 0)),
                "queue_idle_time_s": round(secs.get("idle", 0)),
                "cycle_count": u.cycle_count,
            })
        return result

    def dispatch_matrix(self) -> dict:
        excavators = [u for u in self.units.values() if u.unit_type == "excavator"]
        haul_trucks = [u for u in self.units.values() if u.unit_type == "haul_truck"]

        matrix = []
        for ex in excavators:
            # Assign trucks from same site
            site_trucks = [t for t in haul_trucks if t.site_id == ex.site_id]
            # Prefer trucks heading to or at loading
            assigned = [t.unit_id for t in site_trucks
                        if t.status in ("loading", "hauling_empty", "idle")][:3]
            matrix.append({
                "unit_id": ex.unit_id,
                "site_id": ex.site_id,
                "queue_depth": ex.queue_depth or 0,
                "dig_rate_bcm_hr": ex.dig_rate_bcm_hr,
                "assigned_trucks": assigned,
                "status": ex.status,
            })

        return {
            "excavators": matrix,
            "suggestions": self.dispatch_suggestions(),
            "recommendations": self.dispatch_recommendations(),
            "road_utilization": self.road_utilization(),
            "overrides": list(self.dispatch_overrides)[:10],
            "formula": "(1/travel_min)*100 − queue_penalty(25) × queue_depth + target_deficit_weight(0.8) × target_gap_norm × 100",
        }

    def maintenance_health(self) -> list[dict]:
        result = []
        for u in self.units.values():
            score = 100
            if u.fault_code:
                score -= 30
            if u.coolant_temp_c > 100:
                score -= 20
            elif u.coolant_temp_c > 95:
                score -= 10
            if u.oil_pressure_bar < 3.5:
                score -= 15
            if u.hydraulic_pressure_bar and u.hydraulic_pressure_bar > 370:
                score -= 10
            score = max(0, score)

            # [ASUMSI] Tyre life based on engine hours
            tyre_life = max(0, round(100 - u.engine_hours / 100, 1))
            next_service = (math.ceil(u.engine_hours / ASSUMED_SERVICE_INTERVAL_HOURS)
                            * ASSUMED_SERVICE_INTERVAL_HOURS)
            predicted_failure = None
            if score < 60:
                # [ASUMSI] Rough estimate: lower score → sooner failure
                predicted_failure = round((score / 100) * 168, 0)  # within a week

            result.append({
                "unit_id": u.unit_id,
                "unit_type": u.unit_type,
                "site_id": u.site_id,
                "engine_hours": round(u.engine_hours, 1),
                "fault_code": u.fault_code,
                "coolant_temp_c": round(u.coolant_temp_c, 1),
                "oil_pressure_bar": round(u.oil_pressure_bar, 2),
                "hydraulic_pressure_bar": round(u.hydraulic_pressure_bar, 1) if u.hydraulic_pressure_bar else None,
                "health_score": score,
                "predicted_failure_hours": predicted_failure,
                "tyre_life_remaining_pct": tyre_life,
                "next_service_hours": next_service,
            })
        return result

    def shift_summary(self) -> dict:
        today = datetime.now().strftime("%Y%m%d")
        shift_id = f"SHIFT-{today}-DAY"

        site_summaries = {}
        for site_id in ["siteA", "siteB"]:
            site_units = [u for u in self.units.values() if u.site_id == site_id]
            if not site_units:
                continue
            metrics = self._compute_metrics(site_units)
            haul_trucks = [u for u in site_units if u.unit_type == "haul_truck"]
            bcm = sum(u.cycle_count for u in haul_trucks) * ASSUMED_BCM_PER_CYCLE
            # [ASUMSI] delay estimate: idle time proportion
            elapsed_h = (time.time() - self._start_time) / 3600
            idle_pct = metrics.get("idle_pct", 0)
            delays_min = round(elapsed_h * 60 * idle_pct / 100, 1)

            site_summaries[site_id] = {
                "bcm_produced": round(bcm, 1),
                "target_bcm": round(ASSUMED_TARGET_BCM_SHIFT / 2, 1),
                "cycles": sum(u.cycle_count for u in haul_trucks),
                "avg_utilization_pct": metrics.get("utilization_pct", 0),
                "delays_minutes": delays_min,
            }

        all_haul = [u for u in self.units.values() if u.unit_type == "haul_truck"]
        top_performers = sorted(all_haul, key=lambda u: u.cycle_count, reverse=True)[:3]

        downtime_units = [u.unit_id for u in self.units.values() if u.fault_code]

        return {
            "shift_id": shift_id,
            "site_summaries": site_summaries,
            "top_performers": [
                {"unit_id": u.unit_id, "cycles": u.cycle_count,
                 "utilization_pct": self._unit_utilization(u)}
                for u in top_performers
            ],
            "safety_events_count": len(self.safety_events),
            "unplanned_downtime_units": downtime_units,
            "delay_breakdown": self.delay_breakdown(),
        }

    def _unit_utilization(self, unit: UnitState) -> float:
        secs = dict(unit.status_seconds)
        idle_s = secs.get("idle", 0)
        active_s = sum(v for k, v in secs.items() if k != "idle")
        total = idle_s + active_s
        return round((active_s / total * 100) if total > 0 else 0, 1)

    def dispatch_recommendations(self) -> list[dict]:
        """Scoring-based best-path recommendations untuk truck idle / hauling_empty.

        Formula: score = (1/travel_min)*100 − queue_penalty × queue_depth
                       + target_deficit_weight × target_gap_norm * 100
        """
        ASSUMED_SPEED_KMH = 35
        QUEUE_PENALTY = 25          # [ASUMSI] poin penalti per truck di queue
        TARGET_DEFICIT_WEIGHT = 0.8  # [ASUMSI] bobot target gap

        excavators = [u for u in self.units.values() if u.unit_type == "excavator"]
        haul_trucks = [u for u in self.units.values() if u.unit_type == "haul_truck"]

        target_per_site = ASSUMED_TARGET_BCM_SHIFT / 2
        actual_per_site = {}
        for sid in ("siteA", "siteB"):
            cycles = sum(t.cycle_count for t in haul_trucks if t.site_id == sid)
            actual_per_site[sid] = cycles * ASSUMED_BCM_PER_CYCLE

        recommendations = []
        for truck in haul_trucks:
            if truck.status not in ("idle", "hauling_empty"):
                continue
            options = []
            for ex in excavators:
                if ex.site_id != truck.site_id:
                    continue
                dlat = (truck.lat - ex.lat) * 111000
                dlon = (truck.lon - ex.lon) * 111000 * 0.85
                dist_m = (dlat ** 2 + dlon ** 2) ** 0.5
                travel_time_s = max(60, (dist_m / 1000) / ASSUMED_SPEED_KMH * 3600)
                travel_min = travel_time_s / 60
                qd = ex.queue_depth or 0
                target_gap = max(0, target_per_site - actual_per_site.get(truck.site_id, 0))
                target_gap_norm = target_gap / target_per_site if target_per_site > 0 else 0
                score = ((1 / travel_min) * 100) - (QUEUE_PENALTY * qd) + (TARGET_DEFICIT_WEIGHT * target_gap_norm * 100)
                options.append({
                    "excavator_id": ex.unit_id,
                    "distance_m": round(dist_m),
                    "travel_time_s": round(travel_time_s),
                    "queue_depth": qd,
                    "target_gap_pct": round(target_gap_norm * 100, 1),
                    "score": round(score, 1),
                })
            options.sort(key=lambda o: o["score"], reverse=True)
            if options:
                best = options[0]
                recommendations.append({
                    "unit_id": truck.unit_id,
                    "site_id": truck.site_id,
                    "current_status": truck.status,
                    "idle_seconds": round(truck.idle_seconds_this_cycle),
                    "best_path_to": best["excavator_id"],
                    "best_score": best["score"],
                    "options": options,
                })
        recommendations.sort(key=lambda r: r["best_score"], reverse=True)
        return recommendations

    def road_utilization(self) -> list[dict]:
        """Hitung unit aktif per road_segment per site → indikator congestion."""
        seg_map: dict[str, dict] = {}
        for u in self.units.values():
            if u.unit_type != "haul_truck" or not u.road_segment:
                continue
            key = f"{u.site_id}:{u.road_segment}"
            entry = seg_map.setdefault(key, {
                "site_id": u.site_id,
                "segment": u.road_segment,
                "unit_count": 0,
                "units": [],
                "avg_speed_kmh": 0.0,
            })
            entry["unit_count"] += 1
            entry["units"].append(u.unit_id)
            entry["avg_speed_kmh"] += u.current_speed_kmh or 0

        result = []
        for entry in seg_map.values():
            c = entry["unit_count"]
            entry["avg_speed_kmh"] = round(entry["avg_speed_kmh"] / c, 1) if c else 0
            entry["congestion"] = "high" if c >= 3 else "medium" if c == 2 else "low"
            result.append(entry)
        return sorted(result, key=lambda x: (-x["unit_count"], x["site_id"]))

    def add_dispatch_override(self, payload: dict) -> dict:
        record = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": time.time(),
            "unit_id": payload.get("unit_id"),
            "operator": payload.get("operator", "ROC-Operator"),
            "original_target": payload.get("original_target"),
            "new_target": payload.get("new_target"),
            "reason": payload.get("reason", "—"),
        }
        self.dispatch_overrides.appendleft(record)
        return record

    def payload_histogram(self) -> dict:
        """Bin payload samples per truck untuk histogram distribusi."""
        bins = [(60, 70), (70, 80), (80, 90), (90, 100),
                (100, 110), (110, 120), (120, 130), (130, 140)]
        bin_labels = [f"{lo}-{hi}" for lo, hi in bins]

        per_truck = []
        aggregate = [0] * len(bins)
        for u in self.units.values():
            if u.unit_type != "haul_truck":
                continue
            samples = list(u.payload_samples)
            counts = [0] * len(bins)
            for s in samples:
                for i, (lo, hi) in enumerate(bins):
                    if lo <= s < hi:
                        counts[i] += 1
                        aggregate[i] += 1
                        break
            per_truck.append({
                "unit_id": u.unit_id,
                "site_id": u.site_id,
                "sample_count": len(samples),
                "avg_payload_ton": round(sum(samples) / len(samples), 1) if samples else 0,
                "bins": dict(zip(bin_labels, counts)),
            })

        return {
            "bin_labels": bin_labels,
            "per_truck": per_truck,
            "aggregate": dict(zip(bin_labels, aggregate)),
        }

    def delay_breakdown(self) -> dict:
        """Breakdown waktu shift dari status_seconds: productive vs operational delay vs maintenance."""
        productive_s = 0.0
        idle_s = 0.0
        maintenance_s = 0.0

        productive_statuses = {
            "loading", "hauling_loaded", "dumping", "hauling_empty",
            "loading_truck", "swing_back", "pushing", "repositioning",
            "grading", "spraying", "travelling", "servicing",
        }
        idle_statuses = {"idle", "waiting_truck"}

        for u in self.units.values():
            secs = dict(u.status_seconds)
            for status, s in secs.items():
                if status in productive_statuses:
                    productive_s += s
                elif status in idle_statuses:
                    idle_s += s
            # Maintenance proxy: jika ada fault aktif, asumsikan 10% shift_hours_worked sebagai downtime
            if u.fault_code:
                maintenance_s += u.shift_hours_worked * 3600 * 0.10  # [ASUMSI]

        total = productive_s + idle_s + maintenance_s
        if total == 0:
            return {
                "productive_pct": 0, "operational_delay_pct": 0, "maintenance_pct": 0,
                "productive_minutes": 0, "operational_delay_minutes": 0, "maintenance_minutes": 0,
            }

        return {
            "productive_pct": round(productive_s / total * 100, 1),
            "operational_delay_pct": round(idle_s / total * 100, 1),
            "maintenance_pct": round(maintenance_s / total * 100, 1),
            "productive_minutes": round(productive_s / 60, 1),
            "operational_delay_minutes": round(idle_s / 60, 1),
            "maintenance_minutes": round(maintenance_s / 60, 1),
        }

    def cross_site_benchmark(self) -> dict:
        result = {}
        for site_id in ["siteA", "siteB"]:
            units = [u for u in self.units.values() if u.site_id == site_id]
            if not units:
                result[site_id] = {}
                continue
            metrics = self._compute_metrics(units)
            haul_trucks = [u for u in units if u.unit_type == "haul_truck"]
            avg_cycles = (sum(u.cycle_count for u in haul_trucks) / len(haul_trucks)
                          if haul_trucks else 0)
            total_bcm = sum(u.cycle_count for u in haul_trucks) * ASSUMED_BCM_PER_CYCLE
            elapsed_h = (time.time() - self._start_time) / 3600
            # [ASUMSI] fuel estimate: 35 L/hr per unit
            total_fuel_l = len(units) * elapsed_h * 35
            fuel_per_bcm = (total_fuel_l / total_bcm) if total_bcm > 0 else 0
            # [ASUMSI] MTBF: rough estimate
            fault_events = len([e for e in self.safety_events if e["site_id"] == site_id and e["event_type"] == "fault"])
            mtbf = (elapsed_h / fault_events) if fault_events > 0 else elapsed_h

            result[site_id] = {
                "avg_utilization_pct": metrics.get("utilization_pct", 0),
                "avg_cycles_per_truck": round(avg_cycles, 1),
                "fuel_l_per_bcm": round(fuel_per_bcm, 2),
                "mtbf_hours": round(mtbf, 1),
            }

        # Generate insight
        a = result.get("siteA", {})
        b = result.get("siteB", {})
        insight = "Data belum cukup untuk perbandingan."
        if a and b:
            diff = a.get("avg_utilization_pct", 0) - b.get("avg_utilization_pct", 0)
            if diff > 0:
                insight = (f"Site A unggul {diff:.1f}% dalam utilisasi dibanding Site B. "
                           f"[ASUMSI cross-site learning layer]")
            else:
                insight = (f"Site B unggul {abs(diff):.1f}% dalam utilisasi dibanding Site A. "
                           f"[ASUMSI cross-site learning layer]")

        return {"sites": result, "insight": insight}


store = FleetStore()


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
main_loop: asyncio.AbstractEventLoop | None = None


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[backend] MQTT terhubung (code={reason_code})")
    client.subscribe(MQTT_TOPIC_FILTER)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        return

    store.update_from_payload(payload)

    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": "telemetry_update",
                "unit": payload,
                "metrics_overall": store.metrics_overall(),
                "metrics_by_site": store.metrics_by_site(),
                "alerts": list(store.alerts),
                "dispatch": store.dispatch_suggestions(),
                "safety_events": list(store.safety_events)[:20],
            }),
            main_loop,
        )


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pama-backend-v3")
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

app = FastAPI(title="PAMA Fleet MVS Backend v3")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
    expose_headers=["Authorization"],
)


# -------------------- Auth endpoints --------------------

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
async def auth_login(body: LoginRequest):
    user = find_user_by_username(body.username)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )
    if user.get("disabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun ini telah dinonaktifkan",
        )
    token = create_access_token(user)
    return {"access_token": token, "user": public_user(user)}


@app.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


# -------------------- Guard semua /api/* dengan JWT --------------------

# Path /api/* yang public (untuk in-cab device — tidak punya token)
_PUBLIC_API_PREFIXES = ("/api/incab/",)


@app.middleware("http")
async def api_auth_guard(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and request.method != "OPTIONS" \
            and not any(path.startswith(p) for p in _PUBLIC_API_PREFIXES):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return JSONResponse(
                {"detail": "Token tidak ditemukan"},
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = auth_header.split(None, 1)[1]
        try:
            decode_token(token)
        except JWTError as e:
            return JSONResponse(
                {"detail": f"Token invalid: {e}"},
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
            )
    return await call_next(request)


@app.on_event("startup")
async def startup():
    global main_loop
    main_loop = asyncio.get_event_loop()
    ensure_seed()
    mqtt_client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()
    set_dispatch_context(mqtt_client, main_loop)
    print("[backend] FastAPI v3 siap.")


@app.on_event("shutdown")
async def shutdown():
    mqtt_client.loop_stop()
    mqtt_client.disconnect()


# --- Core endpoints ---
@app.get("/api/fleet")
async def get_fleet():
    return store.snapshot()

@app.get("/api/metrics")
async def get_metrics():
    return store.metrics_overall()

@app.get("/api/metrics/by-site")
async def get_metrics_by_site():
    return store.metrics_by_site()

@app.get("/api/alerts")
async def get_alerts():
    return list(store.alerts)

@app.get("/api/dispatch")
async def get_dispatch():
    return store.dispatch_suggestions()

@app.get("/api/units")
async def get_units():
    return list(store.units.keys())

@app.get("/api/guidance/{unit_id}")
async def get_guidance(unit_id: str):
    data = store.guidance_for_unit(unit_id)
    if not data:
        return {"error": f"Unit {unit_id} tidak ditemukan"}
    return data

@app.get("/api/incab/{unit_id}")
async def get_incab(unit_id: str):
    data = store.incab_data(unit_id)
    if not data:
        return {"error": f"Unit {unit_id} tidak ditemukan"}
    return data

# --- ROC endpoints ---
@app.get("/api/roc/production-kpi")
async def get_production_kpi():
    return store.production_kpi()

@app.get("/api/roc/payload-analysis")
async def get_payload_analysis():
    return store.payload_analysis()

@app.get("/api/roc/cycle-breakdown")
async def get_cycle_breakdown():
    return store.cycle_breakdown()

@app.get("/api/roc/dispatch-matrix")
async def get_dispatch_matrix():
    return store.dispatch_matrix()

@app.get("/api/roc/safety-events")
async def get_safety_events():
    return list(store.safety_events)

@app.get("/api/roc/maintenance-health")
async def get_maintenance_health():
    return store.maintenance_health()

@app.get("/api/roc/shift-summary")
async def get_shift_summary():
    return store.shift_summary()

@app.get("/api/roc/cross-site-benchmark")
async def get_cross_site_benchmark():
    return store.cross_site_benchmark()

@app.get("/api/roc/payload-histogram")
async def get_payload_histogram():
    return store.payload_histogram()

@app.get("/api/roc/delay-breakdown")
async def get_delay_breakdown():
    return store.delay_breakdown()

@app.get("/api/roc/road-utilization")
async def get_road_utilization():
    return store.road_utilization()

@app.get("/api/roc/dispatch-recommendations")
async def get_dispatch_recommendations():
    return store.dispatch_recommendations()

@app.get("/api/roc/dispatch-overrides")
async def get_dispatch_overrides():
    return list(store.dispatch_overrides)

@app.post("/api/roc/dispatch-override")
async def post_dispatch_override(payload: dict):
    return store.add_dispatch_override(payload)

@app.get("/api/geofences")
async def get_public_geofences():
    """Read-only feed dari geofences.json — dipakai ROC map untuk render overlay.
    Admin tetap satu-satunya yang boleh write (lewat /admin/geofences)."""
    import json as _json
    from pathlib import Path as _Path
    p = _Path(__file__).parent / "data" / "geofences.json"
    if not p.exists():
        return []
    try:
        return _json.loads(p.read_text(encoding="utf-8")).get("geofences", [])
    except _json.JSONDecodeError:
        return []


async def _ws_handler(websocket: WebSocket, token: str | None):
    user = validate_ws_token(token)
    if not user:
        # Harus accept dulu untuk bisa kirim close code custom (4401 = unauthorized)
        await websocket.accept()
        await websocket.close(code=4401, reason="Token invalid atau tidak ada")
        return

    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "initial_snapshot",
            "user": user,
            "units": store.snapshot(),
            "metrics_overall": store.metrics_overall(),
            "metrics_by_site": store.metrics_by_site(),
            "alerts": list(store.alerts),
            "dispatch": store.dispatch_suggestions(),
            "safety_events": list(store.safety_events)[:20],
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    await _ws_handler(websocket, token)


@app.websocket("/ws/fleet")
async def websocket_fleet(websocket: WebSocket, token: str | None = None):
    await _ws_handler(websocket, token)


app.include_router(admin_router)
app.include_router(dispatch_router)


@app.websocket("/ws/incab/{unit_id}")
async def ws_incab(websocket: WebSocket, unit_id: str):
    """Push instruksi ke in-cab device. MVS: no auth ketat — unit_id valid sudah cukup."""
    from dispatch import _read_instructions, _read_feedback, _find_unit
    if not _find_unit(unit_id):
        await websocket.accept()
        await websocket.close(code=4404, reason=f"Unit {unit_id} tidak ditemukan")
        return
    await websocket.accept()
    await incab_manager.register(unit_id, websocket)
    # Push pending unacked instructions
    pending = [i for i in _read_instructions() if i["unit_id"] == unit_id and i["status"] != "ack"]
    for inst in reversed(pending[:10]):
        try:
            await websocket.send_json({"type": "instruction", "data": inst})
        except Exception:
            break
    # Push pending unacked feedback
    pending_fb = [f for f in _read_feedback() if f["unit_id"] == unit_id and f["status"] != "ack"]
    for fb in reversed(pending_fb[:10]):
        try:
            await websocket.send_json({"type": "feedback", "data": fb})
        except Exception:
            break
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await incab_manager.unregister(unit_id, websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
