#!/usr/bin/env python3
"""Build deploy payload for edge function from make-server-ea36795c/"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "supabase", "functions", "make-server-ea36795c")

files = []
for name in sorted(os.listdir(SRC)):
    if name.endswith(".bak"):
        continue
    if not (name.endswith(".ts") or name.endswith(".tsx")):
        continue
    path = os.path.join(SRC, name)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    files.append({"name": name, "content": content})

payload = {
    "project_id": "qvbskdjvnpjjmtufvnly",
    "name": "make-server-ea36795c",
    "entrypoint_path": "index.ts",
    "verify_jwt": False,
    "files": files,
}

out_path = os.path.join(HERE, "deploy_payload.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False)

print(f"Wrote {out_path}")
print(f"Files: {len(files)}")
print(f"Bytes: {os.path.getsize(out_path)}")
for file_entry in files:
    print(f"  - {file_entry['name']}: {len(file_entry['content'])} chars")
