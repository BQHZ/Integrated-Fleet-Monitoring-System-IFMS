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

Default credentials (UBAH untuk production):
- `admin` / `admin123` → super_admin
- `dispatcher.mtbu` / `mtbu123` → roc_dispatcher (site MTBU)
- `dispatcher.adro` / `adro123` → roc_dispatcher (site ADRO)

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

## ROC Dashboard — 5 Halaman

1. **Fleet Overview** — Live map, KPI produksi, utilisasi, tabel unit
2. **Dispatch Board** — Assignment matrix excavator-truck, payload distribution, cycle breakdown
3. **Safety Monitor** — Event log, speed zones, operator ranking
4. **Maintenance** — Health score per unit, predictive alerts, cross-site benchmark
5. **Shift Report** — BCM target vs aktual, delay breakdown, summary per unit

## Catatan

Semua angka berlabel **[ASUMSI]** adalah nilai estimasi untuk keperluan demo, bukan data PAMA riil.
