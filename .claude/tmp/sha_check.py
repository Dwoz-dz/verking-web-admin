#!/usr/bin/env python3
"""Emit a SHA256 per file so I can verify my inline deploy call matches."""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "deploy_payload.json"), "r", encoding="utf-8") as f:
    p = json.load(f)

for file_entry in p["files"]:
    h = hashlib.sha256(file_entry["content"].encode("utf-8")).hexdigest()
    print(f"{h[:16]}  {file_entry['name']}  ({len(file_entry['content'])} chars)")
