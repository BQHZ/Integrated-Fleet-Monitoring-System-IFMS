# H2 — Kriteria Sukses Demo MVS (Draft v1)

## Status: ⏳ MENUNGGU KONFIRMASI SCOPE & JAWABAN OPEN QUESTIONS

---

## 1. Klarifikasi Cakupan

### ✅ MASUK (berdasarkan kapabilitas MVS yang sudah dibangun)

| Kapabilitas MVS | Komponen | Grounded di |
|---|---|---|
| **Live telemetry** — 11 unit, 6 tipe, 2 site, 4s interval | Simulator → MQTT → Backend → WebSocket → ROC | `simulator.py`, `main.py` on_message |
| **ROC Dashboard 5 halaman** — Fleet Overview (map + KPI), Dispatch Board (scoring + override), Safety Monitor, Maintenance, Shift Report | ROC App | `roc-app/src/pages/` |
| **In-Cab Display per tipe** — Haul Truck, Excavator, Dozer, Grader, Water Truck, Service Truck | In-Cab App | `incab-app/src/displays/` |
| **Multi-site comparison** — cross-site benchmark (utilisasi, cycles/truck, fuel/BCM, MTBF) | Backend endpoint | `/api/roc/cross-site-benchmark` |
| **Alert system** — fault code, fuel low, idle, speed violation, harsh brake, no-go zone, fatigue, near-miss | Backend FleetStore | `main.py` L240–314 |
| **Dispatch engine** — scoring-based best-path, queue penalty, target deficit, road congestion heatmap | Backend + ROC | `/api/roc/dispatch-matrix` |
| **Proxy $/BCM** — total_cost / total_bcm calculation | Backend FleetStore | `_compute_metrics()` L354–385 |
| **Dispatcher instructions** — waypoint, digging/dumping, speed limit, message, assignment → push ke In-Cab | dispatch.py + In-Cab WS | `/ws/incab/{unit_id}` |
| **Coaching feedback** — safety/productivity/quality/praise → In-Cab inbox | dispatch.py | feedback endpoint |
| **RBAC** — super_admin (full CRUD) vs roc_dispatcher (scoped per site) | auth.py + admin.py | seed_users.py |
| **Admin module** — User Management, Fleet Master, Geofence Editor (incl. map editor), Audit Log | admin.py | `/admin/*` |
| **Payload analysis** — histogram distribusi, underload/nominal/overload categorization | Backend | `/api/roc/payload-histogram` |
| **Cycle breakdown** — loading, haul loaded, dump, return, queue idle per truck | Backend | `/api/roc/cycle-breakdown` |
| **Delay breakdown** — productive vs operational delay vs maintenance (minutes + %) | Backend | `delay_breakdown()` |
| **Shift report** — BCM target vs aktual per site, top performers, downtime units | Backend | `/api/roc/shift-summary` |

### ❌ TIDAK MASUK (jangan di-demo)

| Item | Alasan |
|---|---|
| Production-grade security | MVS scope — semua password default, CORS `*`, in-cab tanpa auth |
| Real GPS/GNSS data | Simulator sintetik — koordinat asumsi, bukan data PAMA riil |
| Actual KOMTRAX/POCSYS integration | Tidak ada integrasi live — MVS proof-of-concept standalone |
| Real predictive ML model | Health score = rule-based (fault + coolant + oil pressure), bukan trained model |
| Real mine plan / topography | Geofence dan waypoint adalah placeholder simulasi |
| Multi-shift historical playback | Backend hanya menyimpan state sesi berjalan, tidak ada persistent DB |

### ⚠️ HARUS DI-DISCLAIMER SAAT DEMO

| Item | Label yang sudah ada di code |
|---|---|
| BCM per cycle = 18 BCM | `[ASUMSI]` — `ASSUMED_BCM_PER_CYCLE` |
| Cost per hour = $45 | `[ASUMSI]` — `ASSUMED_COST_PER_HOUR_USD` |
| Target BCM/shift = 2,500 | `[ASUMSI]` — `ASSUMED_TARGET_BCM_SHIFT` |
| Service interval = 250 hrs | `[ASUMSI]` — `ASSUMED_SERVICE_INTERVAL_HOURS` |
| Fuel rate = 35 L/hr per unit | `[ASUMSI]` — cross_site_benchmark() |
| Fatigue threshold = 7 jam | `[ASUMSI]` — L282 |
| Near-miss = 30m threshold | `[ASUMSI]` — L294 |
| Harsh brake = delta >12 km/h / 4s | `[ASUMSI]` — proxy MPU6050 |

---

## 2. Open Questions — Butuh Jawaban Sebelum Finalisasi

> [!IMPORTANT]
> Saya tidak akan draft kriteria sukses final tanpa jawaban ini. Setiap pertanyaan mempengaruhi apa yang masuk/keluar dari demo flow.

### Q1: Format & Durasi Demo
- Demo akan **live di depan juri** atau **recorded video**?
- Berapa menit durasi demo yang dialokasikan?
- Apakah ada sesi Q&A langsung setelah demo? (pengaruh ke seberapa dalam kita perlu jelaskan asumsi)

### Q2: Audience Familiarity
- Kamu bilang juri = Astra Digital, product/ops-oriented. Apakah mereka pernah **melihat FMS seperti Dispatch/Jigsaw/Modular/Wenco** secara langsung? Ini mempengaruhi apakah kita harus jelaskan konsep dispatch scoring atau langsung tunjukkan keunggulan pendekatan kita.

### Q3: North Star Visibility
- Apakah proxy $/BCM sudah **ditampilkan secara visible** di Fleet Overview KPI bar? Atau hanya ada di API response? Saya perlu tahu apakah ini harus di-highlight di demo atau sudah obvious di UI.

### Q4: Demo Scenario — Scripted atau Free-Flow?
- Apakah kamu sudah punya **script demo** (langkah per langkah apa yang diklik/ditunjukkan)?
- Atau demo akan free-flow "tunjukkan apa yang bisa"?
- Rekomendasi saya: **scripted** — setiap klik harus punya narasi yang terhubung ke North Star ($/BCM).

### Q5: Alert yang Harus Menyala Saat Demo
- Kamu menyebut "minimal 1 alert menyala" di kriteria. Dari 8 jenis alert yang sudah dibangun, **mana yang paling impactful** untuk ditunjukkan ke juri?
  - Speed violation (operator behavior → safety cost)
  - Harsh brake (safety + tyre cost)
  - No-go zone entry (safety non-negotiable)
  - Fault code (maintenance → downtime cost)
  - Fatigue (safety → HSE compliance)
  - Near-miss (collision avoidance)
  - Fuel low (operational)
  - Idle >60s (productivity loss)

### Q6: Cross-Site Learning Framing
- Bagian cross-site benchmark sudah ada di Maintenance page. Apakah kamu ingin ini menjadi **highlight utama** demo (untuk setup H4 — cross-site learning layer)?
- Atau ini cukup ditunjukkan sekilas dan pendalaman di slide presentasi?

### Q7: In-Cab Demo Scope
- Berapa tipe In-Cab yang ingin ditunjukkan di demo? Semua 6 tipe, atau cukup 2–3 representatif (hauler + excavator + 1 support)?
- Apakah flow **instruction delivery** (dispatcher kirim → In-Cab terima → operator acknowledge) harus di-demo live?

### Q8: Dispatcher Workflow
- Apakah fitur **Set Digging/Dumping Point → Draw Route → Send to Unit** harus di-demo? Ini fitur paling visual dan interaktif, tapi butuh narasi yang jelas tentang kenapa ini better than radio communication.

---

## 3. Draft Kriteria Sukses (Provisional — subject to Q1–Q8)

> [!NOTE]
> Format: **Kriteria → Bukti Observable → Kaitannya ke North Star → Pass/Fail Condition**

### Kriteria 1: Data Pipeline End-to-End (Proof of Technical Viability)

| Item | Detail |
|---|---|
| **Kriteria** | Simulator → MQTT → Backend → WebSocket → Dashboard: data mengalir end-to-end tanpa intervensi manual |
| **Bukti Observable** | Buka ROC Fleet Overview → unit bergerak di map, KPI bar berubah real-time, timestamp update < 5 detik |
| **Pass Condition** | ≥10 dari 11 unit visible di dashboard dalam 30 detik setelah simulator start |
| **Fail Condition** | Unit tidak muncul, data stale > 15 detik, WebSocket disconnect tanpa reconnect |
| **North Star Link** | Pipeline ini adalah tulang punggung: tanpa data real-time, tidak ada visibility → tidak bisa optimasi $/BCM |
| **Confidence** | **High** — sudah terverifikasi end-to-end di development |
| **Sumber** | Codebase: `simulator.py` → MQTT topic `pama/fleet/{site}/{unit}/telemetry` → `main.py` on_message → WebSocket broadcast |

---

### Kriteria 2: Alert System Aktif (Safety Guardrail ≠ Teori)

| Item | Detail |
|---|---|
| **Kriteria** | Minimal 2 jenis alert berbeda menyala secara organik dalam 2 menit simulasi berjalan |
| **Bukti Observable** | Safety Monitor page menunjukkan event baru (speed violation / harsh brake / no-go zone / fault) dengan severity badge |
| **Pass Condition** | ≥2 alert types muncul dengan data yang konsisten (unit_id, severity, timestamp, deskripsi) |
| **Fail Condition** | Nol alert dalam 3 menit, atau alert dengan data tidak konsisten (e.g. unit tidak ada di fleet) |
| **North Star Link** | Safety guardrail = non-negotiable layer di atas $/BCM. Setiap speed violation = risiko tyre cost + incident cost. Setiap harsh brake = tyre wear accelerated. Ini bukan "nice to have" — ini cost avoidance |
| **Confidence** | **High** — simulator memiliki probabilistik event: speed_violation ~5%/tick, harsh_brake ~4%/tick, fault ~2%/tick |
| **Sumber** | `simulator.py` L246–280 (speed/brake/no-go logic), `main.py` L257–314 (event raising) |

---

### Kriteria 3: Dispatch Scoring Transparan (Bukan Black Box)

| Item | Detail |
|---|---|
| **Kriteria** | Dispatch Board menampilkan rekomendasi best-path dengan scoring formula yang visible dan bisa di-override oleh dispatcher |
| **Bukti Observable** | (a) Truck idle/hauling_empty muncul di recommendation panel, (b) skor numerik visible, (c) dispatcher bisa override → audit trail tercatat |
| **Pass Condition** | Formula terlihat: `(1/travel_min)×100 − queue_penalty(25)×queue_depth + target_deficit(0.8)×gap_norm×100`. Override tercatat dengan before/after + reason |
| **Fail Condition** | Rekomendasi muncul tanpa skor, atau override tidak tercatat di audit |
| **North Star Link** | Dispatch optimization → reduce idle time → more cycles/shift → higher BCM/shift → lower $/BCM. Setiap menit idle hauler = ~$0.75 terbuang [ASUMSI $45/hr] |
| **Confidence** | **High** — formula hardcoded di `dispatch_recommendations()` |
| **Sumber** | `main.py` L698–755, ROC DispatchBoard.jsx |

---

### Kriteria 4: Cross-Site Comparison Aktif (Setup untuk H4 — Cross-Site Learning)

| Item | Detail |
|---|---|
| **Kriteria** | Dashboard menampilkan perbandingan Site A vs Site B pada ≥3 metrik operasional secara simultan |
| **Bukti Observable** | Maintenance page → Cross-Site Benchmark panel menunjukkan: avg_utilization_pct, avg_cycles_per_truck, fuel_l_per_bcm, mtbf_hours — dengan insight text |
| **Pass Condition** | Kedua site menampilkan data non-zero, insight text menunjukkan site mana yang unggul |
| **Fail Condition** | Hanya 1 site tampil, atau metrik semua nol |
| **North Star Link** | Cross-site visibility = prerequisite cross-site learning layer. Tanpa ini, setiap site beroperasi sebagai silo. Dengan ini: best practice dari site A bisa direplikasi ke site B → fleet-wide $/BCM improvement |
| **Confidence** | **High** — endpoint `/api/roc/cross-site-benchmark` sudah return data dengan insight |
| **Sumber** | `main.py` L869–909 |

---

### Kriteria 5: Proxy $/BCM Terhitung dan Visible (North Star Bukan Slogan)

| Item | Detail |
|---|---|
| **Kriteria** | Dashboard menampilkan proxy $/BCM yang dihitung dari data live (total_cost / total_bcm) |
| **Bukti Observable** | Fleet Overview KPI bar → `proxy_usd_per_bcm` value visible, berubah seiring simulasi berjalan |
| **Pass Condition** | Nilai $/BCM non-null, berubah minimal 1x dalam 2 menit, dan secara logis konsisten (turun saat cycles bertambah) |
| **Fail Condition** | $/BCM = null atau static sepanjang demo |
| **North Star Link** | **Ini IS the North Star**. Setiap fitur yang kita demo harus bisa ditarik ke angka ini. Jika $/BCM tidak visible → kita kehilangan anchor ekonomi |
| **Confidence** | **Medium** — endpoint menghitung, tapi perlu verifikasi apakah UI sudah render angka ini secara prominent |
| **Sumber** | `main.py` `_compute_metrics()` L376: `proxy = (total_cost / total_bcm)` |

> [!WARNING]
> **Q3 belum dijawab**: Saya perlu konfirmasi apakah proxy $/BCM sudah terekspos di UI Fleet Overview atau hanya di API response. Jika belum di UI, ini harus ditambahkan sebelum demo.

---

### Kriteria 6: Two-Way Communication ROC ↔ In-Cab (Closed-Loop Operations)

| Item | Detail |
|---|---|
| **Kriteria** | Dispatcher mengirim instruksi dari ROC → In-Cab menerima + menampilkan → Operator acknowledge → status update kembali ke ROC |
| **Bukti Observable** | (a) Dispatcher di ROC klik "Send Instruction" ke DT-A01, (b) In-Cab DT-A01 menampilkan InstructionBanner (dengan chime), (c) Operator klik Acknowledge → ROC menampilkan ✓ |
| **Pass Condition** | Round-trip < 3 detik, status berubah dari pending → ack |
| **Fail Condition** | Instruksi tidak sampai, atau acknowledge tidak ter-reflect di ROC |
| **North Star Link** | Closed-loop = dispatcher bisa course-correct operator behavior real-time → reduce empty haul waste, enforce speed limits → $/BCM down |
| **Confidence** | **High** — WebSocket push via `/ws/incab/{unit_id}` sudah implemented |
| **Sumber** | `dispatch.py`, `incab-app/src/shared/`, `roc-app DispatchBoard.jsx` |

---

### Kriteria 7: Multi-Unit-Type Coverage (Bukan Hauler-Only FMS)

| Item | Detail |
|---|---|
| **Kriteria** | Demo menunjukkan In-Cab display yang berbeda untuk ≥3 tipe unit, masing-masing dengan telemetry fields spesifik tipe |
| **Bukti Observable** | Haul Truck display (payload, speed, cycle), Excavator display (bucket swings, dig rate, queue depth), dan ≥1 support unit (Dozer/Grader/Water Truck/Service Truck) |
| **Pass Condition** | Setiap tipe menampilkan field unik (bukan generic) dan data berubah real-time |
| **Fail Condition** | Semua tipe menampilkan template yang sama, atau data null/static |
| **North Star Link** | Ini differentiator utama: FMS biasa fokus hauler. Kita cover seluruh fleet → total fleet cost visibility → **ex-fuel $/BCM** bisa dihitung lintas tipe |
| **Confidence** | **High** — 6 display JSX terpisah sudah dibangun per tipe |
| **Sumber** | `incab-app/src/displays/` (HaulTruckDisplay, ExcavatorDisplay, DozerDisplay, GraderDisplay, WaterTruckDisplay, ServiceTruckDisplay) |

---

## 4. Demo Flow yang Direkomendasikan (Pending Q1–Q8)

> [!TIP]
> Urutan ini dirancang supaya setiap langkah **membangun narasi** menuju North Star, bukan random feature showcase.

```
Opening (30 detik)
"Platform ini menyatukan visibilitas armada tambang ke satu dashboard —
 tujuannya: menurunkan $/BCM yang dikontrol PAMA (ex-fuel), dengan
 safety sebagai guardrail non-negotiable di atasnya."

Step 1: Fleet Overview (60 detik) → Kriteria 1, 5
├─ Tunjukkan map: 11 unit bergerak real-time di 2 site
├─ Highlight KPI bar: BCM/shift, utilisation, availability, $/BCM
└─ "Semua data ini dari simulator — di production, ini dari sensor IoT + GPS"

Step 2: Safety Monitor (45 detik) → Kriteria 2
├─ Tunjukkan alert feed: speed violation, harsh brake, no-go zone
├─ "Ini safety guardrail — sebelum bicara produktivitas, safety harus aman"
└─ "Setiap speed violation = akselerasi tyre wear = biaya"

Step 3: Dispatch Board (60 detik) → Kriteria 3
├─ Tunjukkan recommendation panel: scoring formula visible
├─ Demo override: pilih truck → ubah target → tulis reason → submit
├─ Tunjukkan audit trail
└─ "Dispatcher tetap punya kontrol, tapi keputusan tercatat dan bisa diaudit"

Step 4: ROC → In-Cab Loop (45 detik) → Kriteria 6
├─ Kirim instruksi ke DT-A01 dari ROC
├─ Switch ke In-Cab tab: instruksi muncul dengan chime
├─ Acknowledge → kembali ke ROC: status ✓
└─ "Ini menggantikan radio communication yang tidak terekam"

Step 5: In-Cab Multi-Type (45 detik) → Kriteria 7
├─ Tunjukkan 3 tab In-Cab: Hauler, Excavator, Water Truck
├─ Highlight field unik per tipe
└─ "Bukan hauler-only FMS — seluruh fleet visible"

Step 6: Cross-Site + Shift Report (45 detik) → Kriteria 4
├─ Maintenance page: cross-site benchmark
├─ Shift Report: BCM target vs aktual, delay breakdown
└─ "Ini fondasi cross-site learning layer — data kondisi alat dari 2 site
    disatukan, supaya best practice bisa direplikasi"

Closing (30 detik)
"Yang kami tunjukkan bukan fitur — tapi feedback loop:
 data → visibility → keputusan → eksekusi → ukur dampak ke $/BCM.
 Ini proof-of-concept dalam timeline kompetisi —
 di production, sumber data diganti sensor riil dan model prediktif."

Total: ~6 menit
```

---

## 5. Anti-Pattern yang Harus Dihindari Saat Demo

| ❌ Jangan | ✅ Sebagai Gantinya |
|---|---|
| "Lihat fitur ini keren" | "Fitur ini menurunkan idle time → lebih banyak cycle → $/BCM turun" |
| "Kami punya predictive maintenance" | "Health score ini rule-based di MVS — di production, ini akan ditraining dari data historis via cross-site learning layer" |
| "Real-time dashboard" (tanpa konteks) | "Data mengalir setiap 4 detik dari simulator — di production dari OBD/CAN bus sensor" |
| Demo semua halaman Admin (CRUD user, geofence editor) | Skip admin — juri tidak peduli CRUD. Fokus operational value |
| Klaim angka sebagai data riil | **Selalu tag [ASUMSI]** — "BCM per cycle kami asumsikan 18 BCM, perlu dikalibrasi dengan data aktual PAMA" |
| Banding langsung dengan KOMTRAX/POCSYS | Frame additive: "Melengkapi data KOMTRAX yang sudah ada dengan cross-site aggregation layer" |
