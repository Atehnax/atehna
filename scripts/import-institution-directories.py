#!/usr/bin/env python3
"""Import the nine supplied Ministry HTML-table .xls exports without deduplication.

The attachments are HTML, not binary Excel workbooks. This importer deliberately
uses only Python's standard library, keeps identifier/contact cells as strings,
and fails on an unknown schema or malformed row instead of silently losing data.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
from html.parser import HTMLParser
import itertools
import json
from pathlib import Path
import re
import unicodedata

SOURCES = [
    ("dijaski-domovi", "Javni in zasebni dijaški domovi.xls"),
    ("glasbene-sole", "Javne in zasebne glasbene šole.xls"),
    ("vrtci-z-enotami", "Javni in zasebni vrtci z enotami.xls"),
    ("vrtci", "Javni in zasebni vrtci.xls"),
    ("srednje-sole", "Srednje_šole.xls"),
    ("visje-strokovne-sole", "Višje strokovne šole.xls"),
    ("izobrazevanje-odraslih", "Organizacije za izobraževanje odraslih.xls"),
    ("osnovne-sole-posebne-potrebe", "Osnovne šole za otroke s posebnimi potrebami.xls"),
    ("zavodi-posebne-potrebe", "Zavodi za otroke in mladostnike s posebnimi potrebami.xls"),
]
HEADER_MAP = {
    "ZAVSIF": "zavsif", "PRSMSS": "prsmss", "STATISTIČNA REGIJA": "statisticna-regija",
    "OBČINA": "obcina", "NAZIV": "naziv", "NAZIV ŠOLE": "naziv", "NAZIV VRTCA": "naziv",
    "NASLOV": "naslov", "POŠTNA ŠTEVILKA": "postna-stevilka", "POŠTA": "posta",
    "TEL": "telefon", "E-NASLOV": "e-naslov", "URL": "spletna-stran",
    "Spletna stran (URL)": "spletna-stran", "DŠ": "ds", "TRR": "trr",
}
EXTRA_HEADERS = {"FAX", "ZASEBNA", "Pravni status", "Pri OŠ", "Izvaja SŠ programe"}
EXPECTED_COUNTS = dict(zip((entry[0] for entry in SOURCES), [35, 67, 1188, 415, 190, 59, 94, 28, 15]))


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict]] = []
        self.row: list[dict] | None = None
        self.cell: dict | None = None
        self.table_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.table_count += 1
        if tag == "tr":
            if self.row is not None:
                raise ValueError("Nested/unterminated table row")
            self.row = []
        if tag in ("td", "th"):
            if self.cell is not None or self.row is None:
                raise ValueError("Nested/orphan table cell")
            self.cell = {"text": "", "links": [], "attributes": dict(attrs)}
        if tag == "a" and self.cell is not None:
            href = dict(attrs).get("href")
            if href:
                self.cell["links"].append(href)
        if tag == "br" and self.cell is not None:
            self.cell["text"] += "\n"

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell["text"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th"):
            if self.cell is None or self.row is None:
                raise ValueError("Unexpected closing table cell")
            self.cell["text"] = clean(self.cell["text"])
            self.row.append(self.cell)
            self.cell = None
        if tag == "tr":
            if self.cell is not None or self.row is None:
                raise ValueError("Unexpected closing table row")
            self.rows.append(self.row)
            self.row = None


def parse_directory(directory_id: str, source_file: Path, columns: list[dict]) -> tuple[dict, dict]:
    raw = source_file.read_bytes()
    if raw.startswith(bytes.fromhex("D0CF11E0A1B11AE1")) or raw.startswith(b"PK"):
        raise ValueError(f"{source_file.name}: expected supplied HTML export, not binary Excel")
    # Seven attachments are entirely ASCII plus HTML entities. The two nursery
    # exports contain literal Windows-1250 ć/á bytes; never replace decoding errors.
    encoding = "ascii" if raw.isascii() else "windows-1250"
    text = raw.decode("ascii" if raw.isascii() else "cp1250", errors="strict")
    parser = TableParser()
    parser.feed(text)
    parser.close()
    if parser.table_count != 1 or parser.row is not None or parser.cell is not None:
        raise ValueError(f"{source_file.name}: malformed or unexpected number of tables")
    rows, source_rows, region_headers, header_rows = [], [], [], []
    headers: list[str] | None = None
    region = ""
    ids: Counter = Counter()
    missing_columns: set[str] = set()
    for source_row_number, row in enumerate(parser.rows, start=1):
        values = [cell["text"] for cell in row]
        if len(row) == 1 and row[0]["attributes"].get("colspan") and values[0]:
            region = values[0]
            region_headers.append({"sourceRow": source_row_number, "region": region})
            continue
        if values and values[0] == "ZAVSIF":
            if headers is not None and headers != values:
                raise ValueError(f"{source_file.name}:{source_row_number}: changing headers")
            unknown = set(values) - HEADER_MAP.keys() - EXTRA_HEADERS
            if unknown or len(values) != len(set(values)):
                raise ValueError(f"{source_file.name}: unknown or duplicate headers: {unknown}")
            headers = values
            header_rows.append(source_row_number)
            continue
        if headers is None or len(values) != len(headers) or not re.fullmatch(r"\d+", values[0]):
            raise ValueError(f"{source_file.name}:{source_row_number}: malformed data row {values}")
        cells = {column["id"]: "" for column in columns}
        for header, value in zip(headers, values):
            if header in HEADER_MAP:
                cells[HEADER_MAP[header]] = value
        if not cells["statisticna-regija"] and region:
            cells["statisticna-regija"] = region
        if not cells["naziv"]:
            raise ValueError(f"{source_file.name}:{source_row_number}: no institution name")
        missing_columns.update(set(cells) - {HEADER_MAP[h] for h in headers if h in HEADER_MAP})
        ids[cells["zavsif"]] += 1
        duplicate_suffix = f"-{ids[cells['zavsif']]}" if ids[cells["zavsif"]] > 1 else ""
        row_id = f"institution-{directory_id}-{cells['zavsif']}{duplicate_suffix}"
        if len(row_id) > 80:
            raise ValueError(f"Row ID exceeds 80 characters: {row_id}")
        rows.append({"id": row_id, "cells": cells})
        source_rows.append({
            "rowId": row_id, "sourceRow": source_row_number,
            "values": dict(zip(headers, values)),
            "links": {header: cell["links"] for header, cell in zip(headers, row) if cell["links"]},
        })
    if len(rows) != EXPECTED_COUNTS[directory_id]:
        raise ValueError(f"{source_file.name}: source snapshot count changed: {len(rows)}; review before import")
    assert headers is not None
    label = source_file.stem.replace("_", " ")
    directory = {"id": directory_id, "label": label, "sourceFile": source_file.name, "columns": columns, "rows": rows}
    provenance = {
        "id": directory_id, "label": label, "sourceFile": source_file.name,
        "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
        "format": "HTML table with .xls extension", "encoding": encoding,
        "sourceHeaders": headers, "sourceHeaderRows": header_rows, "regionHeaders": region_headers,
        "importedRows": len(rows), "sourceTableRows": len(parser.rows),
        "mappedColumnIds": [HEADER_MAP[h] for h in headers if h in HEADER_MAP],
        "extraSourceColumns": [h for h in headers if h not in HEADER_MAP],
        "absentStandardColumns": sorted(missing_columns - ({"statisticna-regija"} if region_headers else set())),
        "rows": source_rows,
    }
    return directory, provenance


def overlap_report(directories: list[dict], primary: dict) -> dict:
    all_directories = [{"id": "osnovne-sole", "label": "Osnovne šole", "rows": primary["rows"]}] + directories
    labels = {directory["id"]: directory["label"] for directory in all_directories}
    refs, indexes = {}, {key: defaultdict(list) for key in ("zavsif", "prsmss", "name", "registrationRoot", "ds", "trr")}
    for directory in all_directories:
        for row in directory["rows"]:
            c = row["cells"]
            ref = {"directoryId": directory["id"], "rowId": row["id"], "name": c.get("naziv", ""),
                   "zavsif": c.get("zavsif", ""), "prsmss": c.get("prsmss", ""), "address": c.get("naslov", "")}
            refs[row["id"]] = ref
            values = {
                "zavsif": c.get("zavsif", "").strip(), "prsmss": c.get("prsmss", "").strip(),
                "name": clean(c.get("naziv", "")).casefold(), "ds": re.sub(r"[^0-9]", "", c.get("ds", "")),
                "trr": re.sub(r"[^A-Z0-9]", "", c.get("trr", "").upper()),
            }
            values["registrationRoot"] = values["prsmss"][:7] if re.fullmatch(r"\d{10}", values["prsmss"]) else ""
            for field, value in values.items():
                if value:
                    indexes[field][value].append(ref)
    cross_groups, within_groups = {}, {}
    for field, index in indexes.items():
        cross_groups[field] = [{"value": value, "rows": members} for value, members in sorted(index.items())
                               if len({row["directoryId"] for row in members}) > 1]
        within_groups[field] = []
        for value, members in sorted(index.items()):
            by_directory = defaultdict(list)
            for member in members:
                by_directory[member["directoryId"]].append(member)
            for directory_id, same_directory_members in sorted(by_directory.items()):
                if len(same_directory_members) > 1:
                    within_groups[field].append({"value": value, "directoryId": directory_id, "rows": same_directory_members})
    pairs = defaultdict(lambda: {"sameZavsif": set(), "sameFullPrsmss": set(), "sameName": set(), "sharedEntityEvidence": set()})
    for field, groups in cross_groups.items():
        category = {"zavsif": "sameZavsif", "prsmss": "sameFullPrsmss", "name": "sameName"}.get(field, "sharedEntityEvidence")
        for group in groups:
            for a, b in itertools.combinations(group["rows"], 2):
                if a["directoryId"] == b["directoryId"]:
                    continue
                left, right = sorted((a, b), key=lambda row: row["directoryId"])
                pairs[(left["directoryId"], right["directoryId"])][category].add((left["rowId"], right["rowId"]))
    pair_summary = []
    for (left, right), evidence in sorted(pairs.items()):
        same_entry = evidence["sameZavsif"] | evidence["sameFullPrsmss"] | evidence["sameName"]
        pair_summary.append({
            "leftDirectoryId": left, "rightDirectoryId": right,
            "leftLabel": labels[left], "rightLabel": labels[right],
            "sameZavsifRowPairs": len(evidence["sameZavsif"]),
            "sameFullPrsmssRowPairs": len(evidence["sameFullPrsmss"]),
            "sameNormalizedNameRowPairs": len(evidence["sameName"]),
            "possibleSameEntryRowPairs": len(same_entry),
            "sameNameOnlyRowPairs": len(evidence["sameName"] - evidence["sameZavsif"] - evidence["sameFullPrsmss"]),
            "sharedEntityOnlyRowPairs": len(evidence["sharedEntityEvidence"] - same_entry),
        })
    return {
        "version": 1, "comparisonScope": "All nine supplied files plus the preserved local primary-school comparison snapshot",
        "policy": "No records merged, removed or moved. Same codes/names are review candidates; related branches can share legal identifiers without being duplicate entries.",
        "definitions": {
            "zavsif": "Same exact institution registry code across tabs.",
            "prsmss": "Same full registration/organizational-unit identifier across tabs.",
            "name": "Same Unicode NFC institution name after whitespace normalization and case folding; punctuation preserved.",
            "registrationRoot": "Same first seven digits of a ten-digit PRSMSS; legal-entity/branch relationship, not duplicate proof.",
            "ds": "Same numeric tax identifier; legal-entity relationship, not duplicate proof.",
            "trr": "Same account identifier after spaces/separators removed; shared account, not duplicate proof.",
        },
        "directoryCounts": [{"id": d["id"], "label": d["label"], "rows": len(d["rows"])} for d in all_directories],
        "crossTabGroupCounts": {key: len(groups) for key, groups in cross_groups.items()},
        "withinTabGroupCounts": {key: len(groups) for key, groups in within_groups.items()},
        "directoryPairs": pair_summary, "crossTabGroups": cross_groups, "withinTabGroups": within_groups,
    }


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def write_or_check(path: Path, content: str, check: bool) -> None:
    if check:
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            raise ValueError(f"Generated output is missing/out of date: {path}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--primary-snapshot", type=Path, help="Read-only local primary directory snapshot for overlap comparison")
    parser.add_argument("--check", action="store_true", help="Compare all deterministic outputs without changing files")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    primary_path = root / "src/shared/data/schools-seed.json"
    primary_bytes = primary_path.read_bytes()
    primary = json.loads(primary_bytes)
    directories, provenance = [], []
    for directory_id, filename in SOURCES:
        directory, source = parse_directory(directory_id, args.source_dir / filename, primary["columns"])
        directories.append(directory)
        provenance.append(source)
    row_ids = [row["id"] for directory in directories for row in directory["rows"]]
    if len(row_ids) != len(set(row_ids)) or set(row_ids) & {row["id"] for row in primary["rows"]}:
        raise ValueError("Row IDs collide")
    output_folder = root / "data/imports/schools-and-institutions-2026-09-24"
    comparison_path = output_folder / "primary-comparison-snapshot.json"
    if args.primary_snapshot:
        snapshot = json.loads(args.primary_snapshot.read_text(encoding="utf-8"))
        # The comparison needs no telephone numbers, e-mails or contact people.
        fields = ("zavsif", "prsmss", "naziv", "naslov", "ds", "trr")
        comparison_primary = {"version": 1, "source": "Local existing primary-school directory, captured 2026-09-24 before import", "rows": [
            {"id": row["id"], "cells": {field: row["cells"].get(field, "") for field in fields}}
            for row in snapshot["rows"]
        ]}
        write_or_check(comparison_path, json_text(comparison_primary), args.check)
    else:
        comparison_primary = json.loads(comparison_path.read_text(encoding="utf-8"))
    overlaps = overlap_report(directories, comparison_primary)
    source_report = {
        "version": 1, "importDate": "2026-09-24", "sourcePolicy": "User-supplied files; parsed as data only. Source bytes unchanged.",
        "primaryComparisonSource": "data/imports/schools-and-institutions-2026-09-24/primary-comparison-snapshot.json",
        "primaryComparisonSha256": hashlib.sha256(json_text(comparison_primary).encode("utf-8")).hexdigest(),
        "standardColumnsSource": "src/shared/data/schools-seed.json", "standardColumnsSourceSha256": hashlib.sha256(primary_bytes).hexdigest(),
        "normalization": "HTML entities decoded; Unicode NFC and whitespace normalized. Values remain strings. Missing fields stay empty. Region section headings copied into statistical region. No inference or cross-tab deduplication.",
        "additionalFields": "All source columns, row numbers and links are retained here, including fields not shown in the standardized table. Contact-person fields are absent from all attachments and left empty.",
        "sourceFiles": provenance,
    }
    write_or_check(root / "src/shared/data/institutions-seed.json", json_text({"version": 1, "directories": directories}), args.check)
    write_or_check(output_folder / "source-provenance.json", json_text(source_report), args.check)
    write_or_check(output_folder / "overlaps.json", json_text(overlaps), args.check)
    lines = ["# Schools and institutions import — 24 September 2026", "", "Imported **2,091 rows in nine directories**. Existing primary-school rows are unchanged. All records and cross-tab overlaps remain in their original directories for later review.", "", "| Directory | Imported rows |", "| --- | ---: |"]
    lines.extend(f"| {d['label']} | {len(d['rows'])} |" for d in directories)
    lines += ["", "## Source handling", "", "The `.xls` attachments are HTML table exports, not binary Excel workbooks. Seven contain ASCII plus HTML entities; the two kindergarten files also use literal Windows-1250 characters. Identifiers, postcodes, phone numbers and bank accounts stay strings. The 14 columns and their order exactly match `schools-seed.json`.", "", "Dijaški domovi, Srednje šole and Organizacije za izobraževanje odraslih supply regions as section headings; these are copied into the region field. Missing municipality, tax/account and contact-person details are left blank. FAX, private/legal status, kindergarten-at-primary-school and secondary-program flags are preserved in `source-provenance.json`, alongside every source row and source link. No missing fields were guessed.", "", "Source files were not modified. SHA-256 hashes, source row numbers and decoding details are recorded in `source-provenance.json`.", "", "## Overlaps requiring a later decision", "", "Comparison uses the supplied files and a preserved snapshot of the existing local primary-school table captured before this import. Its 458 row IDs match the seed, but 438 rows have different current display values (mostly shortened school names); those current values are used here. Counts below are row pairs across different tabs, not counts to delete. Several branches can correctly share registration roots, tax IDs or accounts.", "", "| Tab A | Tab B | Same ZAVSIF | Same full PRSMSS | Same normalized name | Name-only candidates | Related-entity pairs only |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |"]
    for pair in overlaps["directoryPairs"]:
        lines.append(f"| {pair['leftLabel']} | {pair['rightLabel']} | {pair['sameZavsifRowPairs']} | {pair['sameFullPrsmssRowPairs']} | {pair['sameNormalizedNameRowPairs']} | {pair['sameNameOnlyRowPairs']} | {pair['sharedEntityOnlyRowPairs']} |")
    lines += ["", "The main repeated registry-code pairs are **207** between Osnovne šole and Javni in zasebni vrtci; **203** between the two kindergarten tabs; **20** between dijaški domovi and Srednje šole; and **5** between special-needs primary schools and Javni in zasebni vrtci. There is additionally **one full-PRSMSS match** between a music school and a secondary school, and **one name-only candidate** between the kindergarten tabs with different registry identifiers. These are review candidates, not automatic deletion decisions.", "", "All individual matches and within-tab repetitions are listed in `overlaps.json`. Exact ZAVSIF/full PRSMSS/name matches are separated from weaker shared-entity evidence; no merging or removal was performed.", "", "## Reproduce / verify", "", "```powershell", 'python -X utf8 scripts/import-institution-directories.py --source-dir "C:/Users/wfqfw/Downloads"', 'python -X utf8 scripts/import-institution-directories.py --source-dir "C:/Users/wfqfw/Downloads" --check', "```", "", "The importer uses the Python standard library only, rejects unexpected schemas or changed snapshot counts, checks globally unique row IDs (maximum 80 characters), and supports a deterministic read-only `--check` run."]
    lines.insert(2, "Audit files: [source provenance](../data/imports/schools-and-institutions-2026-09-24/source-provenance.json), [all overlap groups](../data/imports/schools-and-institutions-2026-09-24/overlaps.json), and [primary comparison snapshot](../data/imports/schools-and-institutions-2026-09-24/primary-comparison-snapshot.json).")
    lines.insert(3, "")
    write_or_check(root / "docs/schools-and-institutions-import-2026-09-24.md", "\n".join(lines) + "\n", args.check)
    print(json.dumps({"mode": "checked" if args.check else "written", "directories": len(directories), "rows": len(row_ids), "primaryRowsUnchanged": len(primary["rows"]), "crossTabGroupCounts": overlaps["crossTabGroupCounts"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
