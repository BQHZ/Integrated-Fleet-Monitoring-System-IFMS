"""
Idempotent user seeder.

Usage:
    python seed_users.py             # buat file kalau belum ada / tambahkan user yang missing
    python seed_users.py --force     # overwrite semua password ke default

Default credentials (UBAH SEBELUM DEMO):
    admin            / admin123      (super_admin, site=None)
    dispatcher.mtbu  / mtbu123       (roc_dispatcher, site=MTBU)
    dispatcher.adro  / adro123       (roc_dispatcher, site=ADRO)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from auth import hash_password

USERS_FILE = Path(__file__).parent / "data" / "users.json"

SEED_USERS = [
    {
        "id": "u1",
        "username": "admin",
        "password_plain": "admin123",
        "role": "super_admin",
        "site": None,
        "name": "ROC Admin",
    },
    {
        "id": "u2",
        "username": "dispatcher.mtbu",
        "password_plain": "mtbu123",
        "role": "roc_dispatcher",
        "site": "MTBU",
        "name": "Dispatcher MTBU",
    },
    {
        "id": "u3",
        "username": "dispatcher.adro",
        "password_plain": "adro123",
        "role": "roc_dispatcher",
        "site": "ADRO",
        "name": "Dispatcher ADRO",
    },
]


def build_user(seed: dict) -> dict:
    return {
        "id": seed["id"],
        "username": seed["username"],
        "password_hash": hash_password(seed["password_plain"]),
        "role": seed["role"],
        "site": seed["site"],
        "name": seed["name"],
    }


def main(force: bool = False):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {"users": []}
    if USERS_FILE.exists():
        try:
            existing = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"[seed] {USERS_FILE} corrupt — akan di-rewrite.")
            existing = {"users": []}

    by_username = {u["username"]: u for u in existing.get("users", [])}

    added = []
    overwritten = []
    for seed in SEED_USERS:
        if seed["username"] not in by_username:
            by_username[seed["username"]] = build_user(seed)
            added.append(seed["username"])
        elif force:
            by_username[seed["username"]] = build_user(seed)
            overwritten.append(seed["username"])

    out = {"users": list(by_username.values())}
    USERS_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")

    print(f"[seed] {USERS_FILE} ({len(out['users'])} user total)")
    if added:
        print(f"[seed] ditambahkan: {', '.join(added)}")
    if overwritten:
        print(f"[seed] di-overwrite (--force): {', '.join(overwritten)}")
    if not added and not overwritten:
        print("[seed] semua user seed sudah ada — no-op")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true",
                        help="Overwrite hash password user seed dengan default")
    args = parser.parse_args()
    main(force=args.force)
