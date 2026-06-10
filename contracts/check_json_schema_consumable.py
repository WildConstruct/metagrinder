"""Contract check: emitted JSON Schemas are consumable by stdlib-only Python,
matching the validator style used in Image_Prep_Research (json/re/pathlib, no
third-party deps). Run: python contracts/check_json_schema_consumable.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).parent / "json-schema"


def check(name: str, required_fields: list[str]) -> None:
    schema = json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))
    definition = schema["definitions"][name]
    required = definition["required"]
    for field in required_fields:
        assert field in required, f"{name}: expected required field {field!r}, got {required}"
    assert definition["properties"]["artifact"]["const"] == name or \
        definition["properties"]["artifact"].get("enum") == [name] or \
        "artifact" in definition["properties"], f"{name}: artifact discriminator missing"
    print(f"OK {name}: required={required}")


def main() -> int:
    check("source-package", ["chunks", "sourceInputs", "runId", "inputId"])
    check("extraction", ["analysisMode", "runId"])
    check("research-campaign", ["campaignId", "cellId", "targetGapIds"])
    span = json.loads((SCHEMA_DIR / "source-package.schema.json").read_text(encoding="utf-8"))
    span_def = span["definitions"]["source-package"]["properties"]["chunks"]["items"]["properties"]["span"]
    assert sorted(span_def["required"]) == ["end", "start"], span_def
    print("OK span shape: chunks carry [start,end) offsets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
