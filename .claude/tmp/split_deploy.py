#!/usr/bin/env python3
"""Split each deploy file into its own pretty-printed file (one per line per file)."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "deploy_payload.json")

with open(SRC, "r", encoding="utf-8") as f:
    payload = json.load(f)

outdir = os.path.join(HERE, "files_escaped")
os.makedirs(outdir, exist_ok=True)

# Write each file's JSON-escaped content as a standalone .jsonstr file
for entry in payload["files"]:
    name = entry["name"]
    # Use json.dumps to produce a properly escaped string literal (with quotes)
    escaped = json.dumps(entry["content"], ensure_ascii=False)
    path = os.path.join(outdir, name + ".jsonstr")
    with open(path, "w", encoding="utf-8") as f:
        f.write(escaped)
    print(f"Wrote {name}.jsonstr ({len(escaped)} chars)")
