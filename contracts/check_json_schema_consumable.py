"""Contract check: emitted JSON Schemas are consumable by stdlib-only Python,
matching the validator style used in Image_Prep_Research (json/re/pathlib, no
third-party deps). Run: python contracts/check_json_schema_consumable.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

SCHEMA_DIR = Path(__file__).parent / "json-schema"


def read_schema(file_path: Path) -> dict:
    schema = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(schema, dict):
        raise ValueError(f"{file_path.name}: schema must be a JSON object")
    return schema


def check(name: str, required_fields: list[str], schema_dir: Path = SCHEMA_DIR) -> dict:
    schema = read_schema(schema_dir / f"{name}.schema.json")
    definition = schema.get("definitions", {}).get(name)
    if not isinstance(definition, dict):
        raise ValueError(f"{name}: named definition missing")
    required = definition.get("required", [])
    if not isinstance(required, list):
        raise ValueError(f"{name}: required must be a list")
    for field in required_fields:
        if field not in required:
            raise ValueError(f"{name}: expected required field {field!r}, got {required}")
    if name != "provenance":
        artifact = definition.get("properties", {}).get("artifact")
        if not isinstance(artifact, dict) or not ("const" in artifact or "enum" in artifact):
            raise ValueError(f"{name}: artifact discriminator missing")
        if "const" in artifact and artifact["const"] != name:
            raise ValueError(f"{name}: wrong artifact discriminator const {artifact['const']!r}")
        if "enum" in artifact and artifact["enum"] != [name]:
            raise ValueError(f"{name}: wrong artifact discriminator enum {artifact['enum']!r}")
    print(f"OK {name}: required={required}")
    return schema


def resolve_reference(ref: str, current_file: Path, schema_dir: Path, cache: dict[Path, dict]) -> None:
    uri = urlsplit(ref)
    if uri.scheme or uri.netloc or uri.query:
        raise ValueError(f"{current_file.name}: reference must be local: {ref}")
    target_file = (current_file.parent / unquote(uri.path)).resolve() if uri.path else current_file
    if not target_file.is_relative_to(schema_dir):
        raise ValueError(f"{current_file.name}: reference escapes schema directory: {ref}")
    if target_file not in cache:
        if not target_file.is_file():
            raise ValueError(f"{current_file.name}: reference file missing: {ref}")
        cache[target_file] = read_schema(target_file)
    target = cache[target_file]
    fragment = unquote(uri.fragment)
    if fragment:
        if not fragment.startswith("/"):
            raise ValueError(f"{current_file.name}: unsupported reference fragment: {ref}")
        for part in fragment[1:].split("/"):
            key = part.replace("~1", "/").replace("~0", "~")
            if isinstance(target, dict) and key in target:
                target = target[key]
            elif isinstance(target, list) and key.isdecimal() and int(key) < len(target):
                target = target[int(key)]
            else:
                raise ValueError(f"{current_file.name}: reference pointer missing: {ref}")
    if not isinstance(target, (dict, bool)):
        raise ValueError(f"{current_file.name}: reference does not target a schema: {ref}")


def check_references(node: object, current_file: Path, schema_dir: Path, cache: dict[Path, dict]) -> None:
    if isinstance(node, dict):
        if "$ref" in node:
            ref = node["$ref"]
            if not isinstance(ref, str):
                raise ValueError(f"{current_file.name}: reference must be a string")
            resolve_reference(ref, current_file, schema_dir, cache)
        for value in node.values():
            check_references(value, current_file, schema_dir, cache)
    elif isinstance(node, list):
        for value in node:
            check_references(value, current_file, schema_dir, cache)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema-dir", type=Path, default=SCHEMA_DIR)
    schema_dir = parser.parse_args(argv).schema_dir.resolve()
    files = sorted(schema_dir.glob("*.schema.json"))
    if not files:
        raise ValueError(f"no generated schema families found in {schema_dir}")
    extra_required = {
        "source-package": ["chunks", "sourceInputs", "runId", "inputId"],
        "extraction": ["analysisMode", "runId"],
        "research-campaign": ["campaignId", "cellId", "targetGapIds"]
    }
    cache: dict[Path, dict] = {}
    for file_path in files:
        name = file_path.name.removesuffix(".schema.json")
        required = ["attributionMode"] if name == "provenance" else ["artifact", *extra_required.get(name, [])]
        cache[file_path] = check(name, required, schema_dir)
    checked: set[Path] = set()
    while pending := [file_path for file_path in cache if file_path not in checked]:
        for file_path in pending:
            check_references(cache[file_path], file_path, schema_dir, cache)
            checked.add(file_path)
    source_package = cache.get(schema_dir / "source-package.schema.json")
    if source_package is not None:
        span_def = source_package["definitions"]["source-package"]["properties"]["chunks"]["items"]["properties"]["span"]
        if sorted(span_def.get("required", [])) != ["end", "start"]:
            raise ValueError("source-package: span requires start and end")
        print("OK span shape: chunks carry [start,end) offsets")
    print(f"OK {len(files)} generated families: all local references resolve")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(f"contract smoke failed: {error}", file=sys.stderr)
        sys.exit(1)
