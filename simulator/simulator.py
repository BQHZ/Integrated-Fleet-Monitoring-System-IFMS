"""
PAMA Fleet Simulator — v3
==========================
Unit types: haul_truck, excavator, dozer, grader, water_truck, service_truck
Each type has its own state machine and telemetry fields.

Fleet:
  Site A: DT-A01..03 (haul_truck) + EX-A01 (excavator) + DZ-A01 (dozer) + GR-A01 (grader)
  Site B: DT-B01..02 (haul_truck) + EX-B01 (excavator) + WT-B01 (water_truck) + ST-B01 (service_truck)

MQTT topic: pama/fleet/{site_id}/{unit_id}/telemetry
"""

import json
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

MQTT_HOST = "localhost"
MQTT_PORT = 1883
SEND_INTERVAL_SECONDS = 4

SITES = {
    "siteA": {
        "name": "Site A (MTBU - simulasi)",
        "center_lat": -3.5800,
        "center_lon": 115.6000,
        "idle_bias": 0.10,
    },
    "siteB": {
        "name": "Site B (ADRO - simulasi)",
        "center_lat": -2.1800,
        "center_lon": 115.2400,
        "idle_bias": 0.30,
    },
}

LOADING_OFFSET = (0.004, 0.002)
DUMPING_OFFSET = (-0.003, -0.005)

FAULT_CODES = ["P0101_MAF", "P0300_MISFIRE", "P0128_COOLANT_LOW", "P0524_OIL_PRESSURE"]

ROAD_SEGMENTS = {
    "haul_road_main": 40,
    "pit_access": 25,
    "dump_area": 15,
    "loading_zone": 15,
}

# [ASUMSI] Zona terlarang per site — koordinat & radius meter
NO_GO_ZONES = {
    "siteA": [
        {"name": "Blast Area North", "lat": -3.5760, "lon": 115.6030, "radius_m": 80},
        {"name": "Slope Unstable", "lat": -3.5840, "lon": 115.5960, "radius_m": 60},
    ],
    "siteB": [
        {"name": "Blast Prep Zone", "lat": -2.1760, "lon": 115.2430, "radius_m": 80},
    ],
}


def haversine_m(lat1, lon1, lat2, lon2):
    """Approx jarak meter (cukup untuk jarak <1km)."""
    dlat = (lat1 - lat2) * 111000
    dlon = (lon1 - lon2) * 111000 * 0.85
    return (dlat ** 2 + dlon ** 2) ** 0.5


# ============================================================
# BASE UNIT
# ============================================================

@dataclass
class BaseUnit:
    unit_id: str
    unit_type: str
    site_id: str
    lat: float
    lon: float
    status: str = "idle"
    fuel_level_pct: float = field(default_factory=lambda: random.uniform(60, 95))
    engine_hours: float = field(default_factory=lambda: random.uniform(1000, 8000))
    fault_code: str | None = None
    coolant_temp_c: float = field(default_factory=lambda: random.uniform(78, 90))
    oil_pressure_bar: float = field(default_factory=lambda: random.uniform(3.8, 4.8))
    engine_load_pct: float = field(default_factory=lambda: random.uniform(40, 70))
    shift_hours_worked: float = 0.0
    status_started_at: float = field(default_factory=time.time)

    def _tick_base(self):
        """Update shared fields every tick."""
        self.shift_hours_worked += SEND_INTERVAL_SECONDS / 3600
        self.engine_hours += SEND_INTERVAL_SECONDS / 3600

        # Fault simulation
        if random.random() < 0.02:
            self.fault_code = random.choice(FAULT_CODES + [None])
        elif random.random() < 0.20:
            self.fault_code = None

        # Coolant temp drift
        target_coolant = 95 if self.engine_load_pct > 80 else 82
        self.coolant_temp_c += (target_coolant - self.coolant_temp_c) * 0.05
        self.coolant_temp_c += random.uniform(-0.5, 0.5)
        if random.random() < 0.01:
            self.coolant_temp_c = random.uniform(103, 108)  # spike

        # Oil pressure
        self.oil_pressure_bar = max(2.5, min(5.5, self.oil_pressure_bar + random.uniform(-0.05, 0.05)))

    def _fuel_consume(self, rate: float):
        self.fuel_level_pct = max(5, self.fuel_level_pct - rate)
        if self.fuel_level_pct < 20 and random.random() < 0.05:
            self.fuel_level_pct = 95.0  # simulasi refuel

    def _move_toward(self, target_lat: float, target_lon: float):
        step = 0.0006
        self.lat += max(-step, min(step, target_lat - self.lat)) + random.uniform(-0.00005, 0.00005)
        self.lon += max(-step, min(step, target_lon - self.lon)) + random.uniform(-0.00005, 0.00005)

    def _elapsed_in_status(self) -> float:
        return time.time() - self.status_started_at

    def _transition(self, new_status: str):
        self.status = new_status
        self.status_started_at = time.time()

    def base_payload(self) -> dict:
        return {
            "unit_id": self.unit_id,
            "unit_type": self.unit_type,
            "site_id": self.site_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "lat": round(self.lat, 6),
            "lon": round(self.lon, 6),
            "status": self.status,
            "fuel_level_pct": round(self.fuel_level_pct, 1),
            "engine_hours": round(self.engine_hours, 1),
            "fault_code": self.fault_code,
            "coolant_temp_c": round(self.coolant_temp_c, 1),
            "oil_pressure_bar": round(self.oil_pressure_bar, 2),
            "engine_load_pct": round(self.engine_load_pct, 1),
            "shift_hours_worked": round(self.shift_hours_worked, 3),
        }


# ============================================================
# HAUL TRUCK
# ============================================================

@dataclass
class HaulTruck(BaseUnit):
    cycle_count: int = 0
    idle_seconds_this_cycle: float = 0.0
    payload_ton: float = 0.0
    current_speed_kmh: float = 0.0
    prev_speed_kmh: float = 0.0
    speed_limit_kmh: float = 40.0
    road_segment: str = "haul_road_main"
    status_seconds: dict = field(default_factory=dict)
    harsh_brake_event: dict = field(default_factory=lambda: {"detected": False, "deceleration_g": 0.0})
    no_go_proximity: dict = field(default_factory=lambda: {"in_zone": False, "zone_name": None, "distance_m": None})

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]
        self.prev_speed_kmh = self.current_speed_kmh

        if self.status == "idle":
            self.idle_seconds_this_cycle += SEND_INTERVAL_SECONDS
            self.engine_load_pct = random.uniform(15, 30)
            self.current_speed_kmh = 0
            self.road_segment = "loading_zone"
            self._fuel_consume(0.01)
            if random.random() > site_cfg["idle_bias"]:
                self._transition("loading")

        elif self.status == "loading":
            target = (cx + LOADING_OFFSET[0], cy + LOADING_OFFSET[1])
            self._move_toward(*target)
            self.engine_load_pct = random.uniform(40, 60)
            self.current_speed_kmh = random.uniform(2, 8)
            self.speed_limit_kmh = 15
            self.road_segment = "loading_zone"
            self.payload_ton = 0.0
            self._fuel_consume(0.03)
            if elapsed > random.uniform(15, 25):
                # assign payload — occasionally underload for realism
                r = random.random()
                if r < 0.10:
                    self.payload_ton = round(random.uniform(65, 84), 1)   # underload
                elif r < 0.90:
                    self.payload_ton = round(random.uniform(90, 120), 1)  # nominal
                else:
                    self.payload_ton = round(random.uniform(121, 135), 1) # overload
                self._transition("hauling_loaded")

        elif self.status == "hauling_loaded":
            target = (cx + DUMPING_OFFSET[0], cy + DUMPING_OFFSET[1])
            self._move_toward(*target)
            self.engine_load_pct = random.uniform(75, 95)
            self.current_speed_kmh = random.uniform(22, 42)
            self.speed_limit_kmh = 40
            self.road_segment = "haul_road_main"
            self._fuel_consume(0.06)
            if elapsed > random.uniform(20, 35):
                self._transition("dumping")

        elif self.status == "dumping":
            target = (cx + DUMPING_OFFSET[0], cy + DUMPING_OFFSET[1])
            self._move_toward(*target)
            self.engine_load_pct = random.uniform(50, 70)
            self.current_speed_kmh = random.uniform(0, 5)
            self.speed_limit_kmh = 15
            self.road_segment = "dump_area"
            self._fuel_consume(0.02)
            if elapsed > random.uniform(8, 15):
                self.payload_ton = 0.0
                self._transition("hauling_empty")

        elif self.status == "hauling_empty":
            target = (cx + LOADING_OFFSET[0], cy + LOADING_OFFSET[1])
            self._move_toward(*target)
            self.engine_load_pct = random.uniform(55, 75)
            self.current_speed_kmh = random.uniform(25, 45)
            self.speed_limit_kmh = 40
            self.road_segment = "haul_road_main"
            self._fuel_consume(0.04)
            if elapsed > random.uniform(18, 30):
                self.cycle_count += 1
                self.idle_seconds_this_cycle = 0
                if random.random() < site_cfg["idle_bias"]:
                    self._transition("idle")
                else:
                    self._transition("loading")

        # Track time per status
        self.status_seconds[self.status] = self.status_seconds.get(self.status, 0) + SEND_INTERVAL_SECONDS

        # Speed violation simulation
        speed_violated = False
        excess_kmh = 0
        if self.status in ("hauling_loaded", "hauling_empty") and random.random() < 0.05:
            excess = random.uniform(5, 15)
            self.current_speed_kmh = self.speed_limit_kmh + excess
            speed_violated = True
            excess_kmh = round(excess, 1)

        self._speed_violation = {"violated": speed_violated, "excess_kmh": excess_kmh}

        # Harsh brake detection: deceleration besar saat hauling
        # [ASUMSI] proxy MPU6050: delta speed > 12 km/h dalam 4s ≈ deceleration > 0.85g
        self.harsh_brake_event = {"detected": False, "deceleration_g": 0.0}
        if self.status in ("hauling_loaded", "hauling_empty"):
            if random.random() < 0.04:  # ~4% per tick
                delta = random.uniform(12, 22)
                self.current_speed_kmh = max(0, self.current_speed_kmh - delta)
                decel_g = round(delta / SEND_INTERVAL_SECONDS / 35.3, 2)  # km/h/s → g
                self.harsh_brake_event = {"detected": True, "deceleration_g": decel_g}

        # No-go zone proximity check
        in_zone = False
        zone_name = None
        min_dist = None
        for z in NO_GO_ZONES.get(self.site_id, []):
            d = haversine_m(self.lat, self.lon, z["lat"], z["lon"])
            if min_dist is None or d < min_dist:
                min_dist = d
                if d < z["radius_m"]:
                    in_zone = True
                    zone_name = z["name"]
        self.no_go_proximity = {
            "in_zone": in_zone,
            "zone_name": zone_name,
            "distance_m": round(min_dist) if min_dist is not None else None,
        }

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": self.cycle_count,
            "idle_seconds_this_cycle": round(self.idle_seconds_this_cycle, 0),
            "payload_ton": round(self.payload_ton, 1),
            "current_speed_kmh": round(self.current_speed_kmh, 1),
            "speed_limit_kmh": self.speed_limit_kmh,
            "road_segment": self.road_segment,
            "speed_violation": getattr(self, "_speed_violation", {"violated": False, "excess_kmh": 0}),
            "harsh_brake_event": self.harsh_brake_event,
            "no_go_proximity": self.no_go_proximity,
            "status_seconds": self.status_seconds,
            # excavator/dozer/water_truck fields null for haul truck
            "bucket_swings": None,
            "dig_rate_bcm_hr": None,
            "hydraulic_pressure_bar": None,
            "trucks_served_shift": None,
            "queue_depth": None,
            "idle_waiting_seconds": None,
            "push_cycles": None,
            "material_moved_bcm": None,
            "blade_load_pct": None,
            "tank_level_pct": None,
            "spray_rate_l_min": None,
        })
        return p


# ============================================================
# EXCAVATOR
# ============================================================

@dataclass
class Excavator(BaseUnit):
    bucket_swings: int = 0
    dig_rate_bcm_hr: float = field(default_factory=lambda: random.uniform(300, 380))
    hydraulic_pressure_bar: float = field(default_factory=lambda: random.uniform(290, 330))
    trucks_served_shift: int = 0
    queue_depth: int = field(default_factory=lambda: random.randint(0, 3))
    swing_angle_deg: float = field(default_factory=lambda: random.uniform(80, 105))
    idle_waiting_seconds: float = 0.0

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]
        # Excavator stays near loading point
        target = (cx + LOADING_OFFSET[0], cy + LOADING_OFFSET[1])
        self._move_toward(*target)

        if self.status == "waiting_truck":
            self.idle_waiting_seconds += SEND_INTERVAL_SECONDS
            self.engine_load_pct = random.uniform(20, 35)
            self.dig_rate_bcm_hr = max(0, self.dig_rate_bcm_hr - 2)
            self._fuel_consume(0.02)
            # queue_depth fluctuates
            self.queue_depth = max(0, min(5, self.queue_depth + random.randint(-1, 1)))
            if self.queue_depth > 0 or elapsed > random.uniform(10, 20):
                if self.queue_depth == 0:
                    self.queue_depth = random.randint(1, 3)
                self._transition("loading_truck")

        elif self.status == "loading_truck":
            self.engine_load_pct = random.uniform(80, 95)
            self.dig_rate_bcm_hr = min(420, self.dig_rate_bcm_hr + random.uniform(5, 15))
            self.hydraulic_pressure_bar = random.uniform(300, 360)
            if random.random() < 0.01:
                self.hydraulic_pressure_bar = random.uniform(375, 390)  # spike
            self.swing_angle_deg = random.uniform(75, 110)
            self._fuel_consume(0.07)
            if elapsed > random.uniform(12, 20):
                self.bucket_swings += random.randint(3, 6)
                self._transition("swing_back")

        elif self.status == "swing_back":
            self.engine_load_pct = random.uniform(60, 80)
            self._fuel_consume(0.04)
            if elapsed > random.uniform(3, 6):
                self.trucks_served_shift += 1
                self.queue_depth = max(0, self.queue_depth - 1)
                self.idle_waiting_seconds = 0
                if self.queue_depth > 0:
                    self._transition("loading_truck")
                else:
                    self._transition("waiting_truck")

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": self.trucks_served_shift,
            "idle_seconds_this_cycle": round(self.idle_waiting_seconds, 0),
            "bucket_swings": self.bucket_swings,
            "dig_rate_bcm_hr": round(self.dig_rate_bcm_hr, 1),
            "hydraulic_pressure_bar": round(self.hydraulic_pressure_bar, 1),
            "trucks_served_shift": self.trucks_served_shift,
            "queue_depth": self.queue_depth,
            "swing_angle_deg": round(self.swing_angle_deg, 1),
            "idle_waiting_seconds": round(self.idle_waiting_seconds, 0),
            "status_seconds": {},
            # haul truck fields null
            "payload_ton": None,
            "current_speed_kmh": None,
            "speed_limit_kmh": None,
            "road_segment": None,
            "speed_violation": None,
            "push_cycles": None,
            "material_moved_bcm": None,
            "blade_load_pct": None,
            "tank_level_pct": None,
            "spray_rate_l_min": None,
        })
        return p


# ============================================================
# DOZER
# ============================================================

@dataclass
class Dozer(BaseUnit):
    push_cycles: int = 0
    material_moved_bcm: float = 0.0
    blade_load_pct: float = field(default_factory=lambda: random.uniform(50, 80))
    track_slip_pct: float = field(default_factory=lambda: random.uniform(2, 8))
    current_segment: str = "bench_A"

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]
        # Dozer stays near pit area
        target = (cx + random.uniform(-0.002, 0.002), cy + random.uniform(-0.002, 0.002))
        self._move_toward(*target)

        if self.status == "pushing":
            self.engine_load_pct = random.uniform(70, 95)
            self.blade_load_pct = random.uniform(60, 95)
            self.track_slip_pct = random.uniform(3, 15)
            self._fuel_consume(0.05)
            if elapsed > random.uniform(15, 25):
                self.push_cycles += 1
                self.material_moved_bcm += random.uniform(8, 15)  # [ASUMSI] BCM per push
                self._transition("repositioning")

        elif self.status == "repositioning":
            self.engine_load_pct = random.uniform(40, 60)
            self.blade_load_pct = random.uniform(20, 40)
            self.track_slip_pct = random.uniform(1, 5)
            self._fuel_consume(0.03)
            if elapsed > random.uniform(5, 10):
                if random.random() < 0.15:
                    self._transition("idle")
                else:
                    self.current_segment = random.choice(["bench_A", "bench_B", "ramp"])
                    self._transition("pushing")

        elif self.status == "idle":
            self.engine_load_pct = random.uniform(15, 25)
            self.blade_load_pct = 0
            self._fuel_consume(0.01)
            if elapsed > random.uniform(10, 20):
                self._transition("pushing")

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": self.push_cycles,
            "idle_seconds_this_cycle": 0,
            "push_cycles": self.push_cycles,
            "material_moved_bcm": round(self.material_moved_bcm, 1),
            "blade_load_pct": round(self.blade_load_pct, 1),
            "track_slip_pct": round(self.track_slip_pct, 1),
            "current_segment": self.current_segment,
            "status_seconds": {},
            # other unit fields null
            "payload_ton": None,
            "current_speed_kmh": None,
            "speed_limit_kmh": None,
            "road_segment": None,
            "speed_violation": None,
            "bucket_swings": None,
            "dig_rate_bcm_hr": None,
            "hydraulic_pressure_bar": None,
            "trucks_served_shift": None,
            "queue_depth": None,
            "idle_waiting_seconds": None,
            "tank_level_pct": None,
            "spray_rate_l_min": None,
        })
        return p


# ============================================================
# WATER TRUCK
# ============================================================

@dataclass
class WaterTruck(BaseUnit):
    tank_level_pct: float = 100.0
    spray_rate_l_min: float = 0.0
    km_covered_shift: float = 0.0
    current_road_segment: str = "segment_1"

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]

        if self.status == "spraying":
            self.engine_load_pct = random.uniform(50, 70)
            self.spray_rate_l_min = random.uniform(80, 120)
            # Drain tank: ~100 L/min → ~400L per 4s tick
            self.tank_level_pct = max(0, self.tank_level_pct - random.uniform(0.5, 1.2))
            self.km_covered_shift += random.uniform(0.01, 0.03)
            self._fuel_consume(0.035)
            target = (cx + random.uniform(-0.005, 0.005), cy + random.uniform(-0.005, 0.005))
            self._move_toward(*target)
            if elapsed > random.uniform(30, 50) or self.tank_level_pct < 15:
                self._transition("travelling")

        elif self.status == "travelling":
            self.engine_load_pct = random.uniform(40, 60)
            self.spray_rate_l_min = 0
            self._fuel_consume(0.03)
            target = (cx + random.uniform(-0.003, 0.003), cy + random.uniform(-0.003, 0.003))
            self._move_toward(*target)
            if elapsed > random.uniform(15, 25):
                if self.tank_level_pct < 20:
                    self._transition("refilling")
                else:
                    self.current_road_segment = random.choice(["segment_1", "segment_2", "segment_3"])
                    self._transition("spraying")

        elif self.status == "refilling":
            self.engine_load_pct = random.uniform(20, 35)
            self.spray_rate_l_min = 0
            self.tank_level_pct = min(100, self.tank_level_pct + 5)  # refill rate
            self._fuel_consume(0.01)
            if self.tank_level_pct >= 95:
                self._transition("travelling")

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": 0,
            "idle_seconds_this_cycle": 0,
            "tank_level_pct": round(self.tank_level_pct, 1),
            "spray_rate_l_min": round(self.spray_rate_l_min, 1),
            "km_covered_shift": round(self.km_covered_shift, 2),
            "current_road_segment": self.current_road_segment,
            "status_seconds": {},
            # other fields null
            "payload_ton": None,
            "current_speed_kmh": None,
            "speed_limit_kmh": None,
            "road_segment": None,
            "speed_violation": None,
            "bucket_swings": None,
            "dig_rate_bcm_hr": None,
            "hydraulic_pressure_bar": None,
            "trucks_served_shift": None,
            "queue_depth": None,
            "idle_waiting_seconds": None,
            "push_cycles": None,
            "material_moved_bcm": None,
            "blade_load_pct": None,
        })
        return p


# ============================================================
# GRADER
# ============================================================

GRADER_SEGMENTS = ["segment_1", "segment_2", "segment_3", "ramp_north", "ramp_south"]


@dataclass
class Grader(BaseUnit):
    pass_count_shift: int = 0
    passes_on_segment: int = 0
    cross_slope_pct: float = field(default_factory=lambda: random.uniform(-3, 3))
    road_condition_score: float = field(default_factory=lambda: random.uniform(55, 75))
    grader_segment: str = "segment_1"
    current_speed_kmh: float = 0.0
    speed_limit_kmh: float = 20.0

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]
        target = (cx + random.uniform(-0.004, 0.004), cy + random.uniform(-0.004, 0.004))
        self._move_toward(*target)

        if self.status == "grading":
            self.engine_load_pct = random.uniform(55, 75)
            # Grader harus konstan ~10-15 km/h
            self.current_speed_kmh = random.uniform(8, 15)
            self.cross_slope_pct += random.uniform(-0.3, 0.3)
            self.cross_slope_pct = max(-5, min(5, self.cross_slope_pct))
            # Kondisi road meningkat selama grading
            self.road_condition_score = min(95, self.road_condition_score + random.uniform(0.3, 0.8))
            self._fuel_consume(0.04)
            if elapsed > random.uniform(25, 40):
                self.passes_on_segment += 1
                self.pass_count_shift += 1
                self._transition("repositioning")

        elif self.status == "repositioning":
            self.engine_load_pct = random.uniform(35, 50)
            self.current_speed_kmh = random.uniform(15, 22)
            self._fuel_consume(0.025)
            if elapsed > random.uniform(6, 12):
                # Pindah segmen kadang-kadang
                if self.passes_on_segment >= random.randint(2, 4):
                    self.grader_segment = random.choice([s for s in GRADER_SEGMENTS if s != self.grader_segment])
                    self.passes_on_segment = 0
                    # Reset kondisi segmen baru
                    self.road_condition_score = random.uniform(50, 70)
                self._transition("grading")

        elif self.status == "idle":
            self.engine_load_pct = random.uniform(15, 25)
            self.current_speed_kmh = 0
            self._fuel_consume(0.01)
            if elapsed > random.uniform(8, 15):
                self._transition("grading")

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": self.pass_count_shift,
            "idle_seconds_this_cycle": 0,
            "pass_count_shift": self.pass_count_shift,
            "passes_on_segment": self.passes_on_segment,
            "cross_slope_pct": round(self.cross_slope_pct, 2),
            "road_condition_score": round(self.road_condition_score, 1),
            "grader_segment": self.grader_segment,
            "current_speed_kmh": round(self.current_speed_kmh, 1),
            "speed_limit_kmh": self.speed_limit_kmh,
            "status_seconds": {},
            # other fields null
            "payload_ton": None,
            "road_segment": None,
            "speed_violation": None,
            "bucket_swings": None,
            "dig_rate_bcm_hr": None,
            "hydraulic_pressure_bar": None,
            "trucks_served_shift": None,
            "queue_depth": None,
            "idle_waiting_seconds": None,
            "push_cycles": None,
            "material_moved_bcm": None,
            "blade_load_pct": None,
            "tank_level_pct": None,
            "spray_rate_l_min": None,
        })
        return p


# ============================================================
# SERVICE TRUCK / FUEL TRUCK
# ============================================================

ASSIGNABLE_UNITS = [
    ("DT-A01", "siteA", "Grid A2"), ("DT-A02", "siteA", "Grid B3"),
    ("DT-A03", "siteA", "Grid C1"), ("EX-A01", "siteA", "Loading Point N"),
    ("DT-B01", "siteB", "Grid D4"), ("DT-B02", "siteB", "Grid E2"),
    ("EX-B01", "siteB", "Loading Point S"),
]


@dataclass
class ServiceTruck(BaseUnit):
    fuel_delivered_l_shift: float = 0.0
    units_serviced_shift: int = 0
    assignment_unit: str | None = None
    assignment_task: str = "fuel"
    assignment_location: str = "—"
    current_speed_kmh: float = 0.0

    def _new_assignment(self):
        target_unit, target_site, loc = random.choice(
            [a for a in ASSIGNABLE_UNITS if a[1] == self.site_id] or ASSIGNABLE_UNITS
        )
        self.assignment_unit = target_unit
        self.assignment_task = random.choice(["fuel", "service", "fuel", "fuel"])
        self.assignment_location = loc

    def step(self, site_cfg: dict):
        self._tick_base()
        elapsed = self._elapsed_in_status()
        cx, cy = site_cfg["center_lat"], site_cfg["center_lon"]
        target = (cx + random.uniform(-0.004, 0.004), cy + random.uniform(-0.004, 0.004))
        self._move_toward(*target)

        if self.assignment_unit is None:
            self._new_assignment()

        if self.status == "travelling":
            self.engine_load_pct = random.uniform(45, 65)
            self.current_speed_kmh = random.uniform(25, 40)
            self._fuel_consume(0.03)
            if elapsed > random.uniform(20, 35):
                self._transition("servicing")

        elif self.status == "servicing":
            self.engine_load_pct = random.uniform(25, 40)
            self.current_speed_kmh = 0
            self._fuel_consume(0.015)
            if elapsed > random.uniform(20, 40):
                if self.assignment_task == "fuel":
                    delivered = random.uniform(300, 800)
                    self.fuel_delivered_l_shift += delivered
                self.units_serviced_shift += 1
                self._new_assignment()
                self._transition("travelling")

        elif self.status == "idle":
            self.engine_load_pct = random.uniform(15, 25)
            self.current_speed_kmh = 0
            self._fuel_consume(0.008)
            if elapsed > random.uniform(10, 20):
                self._transition("travelling")

    def to_payload(self) -> dict:
        p = self.base_payload()
        p.update({
            "cycle_count": self.units_serviced_shift,
            "idle_seconds_this_cycle": 0,
            "fuel_delivered_l_shift": round(self.fuel_delivered_l_shift, 1),
            "units_serviced_shift": self.units_serviced_shift,
            "assignment_unit": self.assignment_unit,
            "assignment_task": self.assignment_task,
            "assignment_location": self.assignment_location,
            "current_speed_kmh": round(self.current_speed_kmh, 1),
            "status_seconds": {},
            # other fields null
            "payload_ton": None,
            "speed_limit_kmh": None,
            "road_segment": None,
            "speed_violation": None,
            "bucket_swings": None,
            "dig_rate_bcm_hr": None,
            "hydraulic_pressure_bar": None,
            "trucks_served_shift": None,
            "queue_depth": None,
            "idle_waiting_seconds": None,
            "push_cycles": None,
            "material_moved_bcm": None,
            "blade_load_pct": None,
            "tank_level_pct": None,
            "spray_rate_l_min": None,
        })
        return p


# ============================================================
# FLEET BUILDER
# ============================================================

def build_fleet() -> list:
    fleet = []
    cfg = SITES

    # Site A: 3 haul trucks + 1 excavator + 1 dozer
    for i in range(1, 4):
        fleet.append(HaulTruck(
            unit_id=f"DT-A{i:02d}", unit_type="haul_truck", site_id="siteA",
            lat=cfg["siteA"]["center_lat"] + random.uniform(-0.002, 0.002),
            lon=cfg["siteA"]["center_lon"] + random.uniform(-0.002, 0.002),
        ))
    fleet.append(Excavator(
        unit_id="EX-A01", unit_type="excavator", site_id="siteA",
        lat=cfg["siteA"]["center_lat"] + LOADING_OFFSET[0],
        lon=cfg["siteA"]["center_lon"] + LOADING_OFFSET[1],
        status="waiting_truck",
    ))
    fleet.append(Dozer(
        unit_id="DZ-A01", unit_type="dozer", site_id="siteA",
        lat=cfg["siteA"]["center_lat"] + random.uniform(-0.001, 0.001),
        lon=cfg["siteA"]["center_lon"] + random.uniform(-0.001, 0.001),
        status="pushing",
    ))
    fleet.append(Grader(
        unit_id="GR-A01", unit_type="grader", site_id="siteA",
        lat=cfg["siteA"]["center_lat"] + random.uniform(-0.003, 0.003),
        lon=cfg["siteA"]["center_lon"] + random.uniform(-0.003, 0.003),
        status="grading",
    ))

    # Site B: 2 haul trucks + 1 excavator + 1 water truck
    for i in range(1, 3):
        fleet.append(HaulTruck(
            unit_id=f"DT-B{i:02d}", unit_type="haul_truck", site_id="siteB",
            lat=cfg["siteB"]["center_lat"] + random.uniform(-0.002, 0.002),
            lon=cfg["siteB"]["center_lon"] + random.uniform(-0.002, 0.002),
        ))
    fleet.append(Excavator(
        unit_id="EX-B01", unit_type="excavator", site_id="siteB",
        lat=cfg["siteB"]["center_lat"] + LOADING_OFFSET[0],
        lon=cfg["siteB"]["center_lon"] + LOADING_OFFSET[1],
        status="waiting_truck",
    ))
    fleet.append(WaterTruck(
        unit_id="WT-B01", unit_type="water_truck", site_id="siteB",
        lat=cfg["siteB"]["center_lat"] + random.uniform(-0.003, 0.003),
        lon=cfg["siteB"]["center_lon"] + random.uniform(-0.003, 0.003),
        status="spraying",
    ))
    fleet.append(ServiceTruck(
        unit_id="ST-B01", unit_type="service_truck", site_id="siteB",
        lat=cfg["siteB"]["center_lat"] + random.uniform(-0.003, 0.003),
        lon=cfg["siteB"]["center_lon"] + random.uniform(-0.003, 0.003),
        status="travelling",
    ))

    return fleet


# ============================================================
# MAIN
# ============================================================

def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pama-simulator-v3")
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    fleet = build_fleet()
    print(f"[simulator] {len(fleet)} unit siap di {len(SITES)} site.")
    print(f"[simulator] Interval: {SEND_INTERVAL_SECONDS}s ke {MQTT_HOST}:{MQTT_PORT}")
    print("[simulator] CTRL+C untuk berhenti.\n")

    try:
        tick = 0
        while True:
            tick += 1
            for unit in fleet:
                site_cfg = SITES[unit.site_id]
                unit.step(site_cfg)
                payload = unit.to_payload()
                topic = f"pama/fleet/{unit.site_id}/{unit.unit_id}/telemetry"
                client.publish(topic, json.dumps(payload))

                fault_flag = " *** FAULT ***" if payload.get("fault_code") else ""
                print(f"[{tick:04d}] {payload['unit_id']:>8} | {payload['unit_type']:12} | "
                      f"{payload['status']:18} | fuel={payload['fuel_level_pct']:5.1f}%{fault_flag}")

            time.sleep(SEND_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\n[simulator] Berhenti.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
