#!/usr/bin/env python3
"""Import manifest.json + public files into prod SQLite (upsert Novel/Comic)."""
import json, os, shutil, sqlite3, sys
from pathlib import Path

def resolve_sqlite_db(repo: Path) -> str:
    url = os.environ.get("DATABASE_URL", "file:./prod.db").strip().strip('"').strip("'")
    if url.startswith("file:"):
        url = url[5:]
    p = Path(url.lstrip("./"))
    if not p.is_absolute():
        # Prisma：相对路径相对于 prisma/schema.prisma 所在目录
        candidate = repo / "prisma" / p
        if candidate.is_file():
            return str(candidate)
        return str(repo / p)
    return str(p)

def main():
    in_dir = Path(sys.argv[sys.argv.index("--in") + 1]) if "--in" in sys.argv else Path("data/literary-samples-bundle")
    repo = Path.cwd()
    manifest = json.loads((in_dir / "manifest.json").read_text(encoding="utf-8"))
    db = resolve_sqlite_db(repo)

    c = sqlite3.connect(db)
    c.row_factory = sqlite3.Row

    def upsert(table, row, pk="id"):
        cols = list(row.keys())
        placeholders = ",".join("?" * len(cols))
        col_names = ",".join(cols)
        vals = []
        for k in cols:
            v = row[k]
            if isinstance(v, bool):
                v = 1 if v else 0
            vals.append(v)
        c.execute(
            f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})",
            vals,
        )

    for n in manifest["novels"]:
        upsert("Novel", n)
    for cm in manifest["comics"]:
        upsert("Comic", cm)
    c.commit()

    copied = 0
    for rel in manifest.get("files", []):
        src = in_dir / "public" / rel.replace("/", os.sep)
        dest = repo / "public" / rel.replace("/", os.sep)
        if not src.is_file():
            print("[warn] skip", rel)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied += 1

    print(f"[ok] novels={len(manifest['novels'])} comics={len(manifest['comics'])} files={copied} db={db}")

if __name__ == "__main__":
    main()
