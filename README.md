# PAMA MVS v3 — Fleet Operations Center

Sistem monitoring armada tambang batubara dengan ROC Dashboard multi-halaman dan In-Cab Display per tipe unit.

## Komponen

| Komponen | Port | Deskripsi |
|---|---|---|
| Mosquitto MQTT | 1883 | Broker MQTT |
| Backend FastAPI | 8000 | REST API + WebSocket |
| Simulator | — | Generator data telemetry |
| ROC App | 5173 | Dashboard ROC (light theme, 5 halaman) |
| In-Cab App | 5174 | Display kabin per unit type |

## Fleet Simulasi

**Site A (MTBU):** DT-A01, DT-A02, DT-A03 (haul_truck) + EX-A01 (excavator) + DZ-A01 (dozer) + GR-A01 (grader)

**Site B (ADRO):** DT-B01, DT-B02 (haul_truck) + EX-B01 (excavator) + WT-B01 (water_truck) + ST-B01 (service_truck)

## Setup Awal (Sekali per Clone)

```bash
# 1. Copy environment template, lalu generate JWT secret yang kuat
cp .env.example .env
python -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"
# salin output ke .env (overwrite JWT_SECRET=...)

# 2. Seed user awal (admin / dispatcher.mtbu / dispatcher.adro)
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
python seed_users.py
```

## Login Credentials (Demo)

⚠️ **UBAH SEMUA PASSWORD untuk production.** Default seed credentials:

| Username | Password | Role | Scope |
|---|---|---|---|
| `admin` | `admin123` | super_admin | Akses semua, CRUD users/units/geofences |
| `dispatcher.mtbu` | `mtbu123` | roc_dispatcher | Hanya site **MTBU** |
| `dispatcher.adro` | `adro123` | roc_dispatcher | Hanya site **ADRO** |

Reset password lewat super_admin → User Management → Reset PW. Atau jalankan ulang
`python seed_users.py --force` (overwrite ke default).

## User Roles

### `super_admin`
- Full CRUD: users, units (fleet master), geofences
- Lihat audit log semua mutasi
- Kirim instruction/feedback ke unit di **semua site** (bypass scope)
- Mengelola operator dispatcher

### `roc_dispatcher`
- Hanya akses unit di **site-nya sendiri** (MTBU atau ADRO)
- Kirim instruction (waypoint/digging/dumping/speed_limit/message/assignment)
- Kirim coaching feedback (safety/productivity/quality/praise)
- Override dispatch recommendations dengan audit trail
- TIDAK bisa CRUD users/units/geofences (UI admin tidak muncul, endpoint 403)

> File yang tidak boleh masuk git (sudah di `.gitignore`): `.env`, `backend/data/users.json`, `venv/`, `node_modules/`, `.claude/`, `__pycache__/`.

## Cara Jalankan (5 Terminal)

### Terminal 1 — Mosquitto MQTT Broker
```bash
# Jika terinstall via winget/installer:
mosquitto -v

# Atau via folder Mosquitto project lama:
cd path/to/Mosquitto
mosquitto -c mosquitto.conf -v
```

### Terminal 2 — Backend FastAPI
```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Git Bash
# atau: venv\Scripts\activate     # CMD/PowerShell

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 3 — Simulator
```bash
cd simulator
source venv/Scripts/activate      # Git Bash
pip install -r requirements.txt
python simulator.py
```

### Terminal 4 — ROC Dashboard
```bash
cd roc-app
npm install
npm run dev
# Buka: http://localhost:5173
```

### Terminal 5 — In-Cab Display
```bash
cd incab-app
npm install
npm run dev
# Buka: http://localhost:5174?unit=DT-A01
```

## In-Cab URL Parameters

Ganti unit dengan menambah `?unit=<unit_id>` di URL:

| URL | Display |
|---|---|
| `http://localhost:5174?unit=DT-A01` | Haul Truck (Site A) |
| `http://localhost:5174?unit=EX-A01` | Excavator (Site A) |
| `http://localhost:5174?unit=DZ-A01` | Dozer (Site A) |
| `http://localhost:5174?unit=GR-A01` | Grader (Site A) |
| `http://localhost:5174?unit=WT-B01` | Water Truck (Site B) |
| `http://localhost:5174?unit=ST-B01` | Service Truck (Site B) |

## Demo di Jaringan WiFi (Tablet/iPad)

Ganti `localhost` ke IP laptop di:
- `roc-app/src/useFleetSocket.js` → `BACKEND_HOST`
- `roc-app/src/api.js` → `BASE_URL`
- `incab-app/src/useUnitData.js` → `BACKEND_HOST`

Cek IP laptop: `ipconfig` (Windows) → IPv4 Address

## ROC Dashboard — Halaman

**Untuk semua user:**
1. **Fleet Overview** — Live MapLibre, KPI produksi (BCM/UoA/Availability), tabel unit
2. **Dispatch Board** — Best-path scoring, override, heatmap road, **Active Instructions** + **Operator Feedback Panel**
3. **Safety Monitor** — Speeding/harsh brake/no-go zone/fatigue/near-miss, operator ranking
4. **Maintenance** — Health score per unit, predictive alerts, cross-site benchmark
5. **Shift Report** — BCM target vs aktual, delay breakdown, payload histogram, **Coaching Summary**

**Khusus super_admin (section "ADMIN" di sidebar):**
- User Management — CRUD user, reset password, soft disable
- Fleet Master — CRUD unit + spec
- Geofence — table editor + **Edit on Map** (klik area→add vertex, drag→move, right-click→delete)
- Audit Log — semua mutasi (user/unit/geofence/instruction/feedback) dengan before/after JSON

## Map Controls (FleetMap di Fleet Overview)

- **Layer Switcher** (kiri-atas) — Street / Satellite / Hybrid / Terrain + **3D pitch** toggle
- **Pan**: drag mouse · **Zoom**: scroll/pinch · **Rotate**: right-click+drag
- **Layer overlay** (toggle via control kanan-atas): Fleet Units, Loading Points, Dump Points, Haul Road, Pit Boundary, No-Go Zones
- **Hover unit** → popup (speed/payload/fuel/status)
- **Click unit** → highlight + ring biru
- **Marker badge** ungu dengan angka → unit ada **pending instruction**

### Dispatcher Tools (kanan-atas, hanya muncul jika roc_dispatcher/super_admin):
- **Set Digging Point** — klik di map → marker orange (local candidate)
- **Set Dumping Point** — klik → marker biru
- **Draw Route** — klik berurutan (smooth bezier curve), double-click selesai
- Setelah candidate ter-set, panel kiri-bawah muncul → tombol **Send to Unit →** buka dialog target unit + priority

## In-Cab Display

- Layout: Top Strip · MiniMap kiri 40% · Display kanan 60% · Bottom Strip
- **Bell 🔔** = pending instructions · **💬** = unread coaching feedback
- **Day/Night toggle** ☀/☾ — preferensi tersimpan di localStorage
- **InstructionBanner** muncul auto saat dispatcher kirim instruksi (dengan chime)
- **FeedbackInbox** klik 💬 → list feedback, praise hijau, safety merah
- **Acknowledge** button → status di ROC berubah ack ✓

## Catatan

- Angka berlabel **[ASUMSI]** = estimasi untuk demo, bukan data PAMA riil
- Field di-tag **[SIM]** = nilai sintetik (di-derive dari simulator basic data)
- Semua user/unit/geofence/instruction/feedback disimpan sebagai JSON file di `backend/data/` (excluded dari git)
