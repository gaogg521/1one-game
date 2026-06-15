#!/usr/bin/env python3
"""Export curated novel/comic samples from local dev.db → data/literary-samples-bundle/"""
import json, os, shutil, sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "prisma" / "dev.db"
OUT = ROOT / "data" / "literary-samples-bundle"
OWNER = "__literary-samples__"

PATTERNS = [
    "煤山", "崇祯", "锦衣卫", "Jinyiwei", "錦衣衛", "洪荒", "废柴世子", "孤剑", "千亿继承人",
    "聪明的小老鼠", "糯米团", "花花草草", "愚公", "时空", "第一章迷雾", "核爆",
]

def showcase(title: str) -> bool:
    return any(p in title for p in PATTERNS)

def row_dict(row, cols):
    return {c: row[i] for i, c in enumerate(cols)}

def collect_paths(cover, image_urls):
    paths = set()
    if cover and str(cover).startswith("/"):
        paths.add(str(cover).lstrip("/"))
    if image_urls:
        try:
            for u in json.loads(image_urls):
                if isinstance(u, str) and u.startswith("/"):
                    paths.add(u.lstrip("/"))
        except Exception:
            pass
    return paths

def main():
    c = sqlite3.connect(DB)
    ncols = [d[1] for d in c.execute("PRAGMA table_info(Novel)")]
    ccols = [d[1] for d in c.execute("PRAGMA table_info(Comic)")]
    novels = [row_dict(r, ncols) for r in c.execute("SELECT * FROM Novel WHERE visibility='public'")]
    comics = [row_dict(r, ccols) for r in c.execute("SELECT * FROM Comic WHERE visibility='public'")]

    novel_ids = {n["id"] for n in novels if n.get("featured") or showcase(n["title"])}
    comic_ids = set()
    for cm in comics:
        if cm.get("featured"):
            comic_ids.add(cm["id"])
            if cm.get("novelId"):
                novel_ids.add(cm["novelId"])
    for cm in comics:
        if cm.get("novelId") in novel_ids:
            comic_ids.add(cm["id"])

    sel_novels = [n for n in novels if n["id"] in novel_ids]
    sel_comics = [cm for cm in comics if cm["id"] in comic_ids]

    files = set()
    for row in sel_novels + sel_comics:
        files |= collect_paths(row.get("coverPath"), row.get("imageUrls"))

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "public").mkdir(parents=True)

    copied = []
    for rel in sorted(files):
        src = ROOT / "public" / rel.replace("/", os.sep)
        dest = OUT / "public" / rel.replace("/", os.sep)
        if not src.is_file():
            print("[warn] missing", rel)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied.append(rel)

    for row in sel_novels + sel_comics:
        row["ownerKey"] = OWNER

    manifest = {
        "version": 1,
        "ownerKey": OWNER,
        "exportedAt": datetime.utcnow().isoformat() + "Z",
        "novels": sel_novels,
        "comics": sel_comics,
        "files": copied,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] novels={len(sel_novels)} comics={len(sel_comics)} files={len(copied)} -> {OUT}")

if __name__ == "__main__":
    main()
