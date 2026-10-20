"""Chuyển file nguồn từ vựng dạng gọn (content-src/*.txt) sang content/*.json.

Mỗi file .txt là một chủ đề:

    #id: business
    #order: 11
    #icon: 🏢
    #title: Business & Companies
    #title_vi: Doanh nghiệp & Công ty
    #desc: Mô tả ngắn bằng tiếng Việt
    word | pos | /ipa/ | nghĩa tiếng Việt | English definition | colloc 1; colloc 2 | Example with *word*. | Câu dịch. | ghi chú (tuỳ chọn) | syn1; syn2 (tuỳ chọn)

Cấp độ CEFR của từng từ lấy từ danh sách Oxford 3000/5000 (tham số --oxford, file JSON
[[word, pos, level, in3000], ...]). Từ không có trong danh sách được gắn nhãn "TOEIC".

Chạy:  python tools/build_vocab.py --oxford path/to/ox_rows.json [--pool path/to/pool.json]
"""

import argparse
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content-src"
OUT = ROOT / "content"
LEVEL_ORDER = ["a1", "a2", "b1", "b2", "c1"]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def load_oxford(path):
    """Cấp độ của từ: ưu tiên nghĩa B1/B2 (nhóm chủ đề này dạy nghĩa B1–B2 của từ quen),
    nếu không có thì lấy cấp thấp nhất."""
    all_levels = {}
    if not path:
        return all_levels
    for word, _pos, lvl, _in3000 in json.loads(Path(path).read_text(encoding="utf-8")):
        all_levels.setdefault(word.lower(), set()).add(lvl)
    levels = {}
    for k, lv in all_levels.items():
        mid = [x for x in ("b1", "b2") if x in lv]
        levels[k] = mid[0] if mid else min(lv, key=LEVEL_ORDER.index)
    return levels


def parse(path, oxford, errors):
    meta = {}
    words = []
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("#"):
            k, _, v = line[1:].partition(":")
            meta[k.strip()] = v.strip()
            continue
        f = [x.strip() for x in line.split(" | ")]
        if len(f) < 8:
            errors.append(f"{path.name}:{n}: cần ít nhất 8 trường, có {len(f)}: {line[:60]}")
            continue
        f += [""] * (10 - len(f))
        word, pos, ipa, meaning, definition, colls, ex_en, ex_vi, note, syn = f[:10]
        if "*" not in ex_en:
            errors.append(f"{path.name}:{n}: câu ví dụ thiếu *từ*: {word}")
        if not ipa.startswith("/"):
            ipa = "/" + ipa.strip("/") + "/"
        lvl = oxford.get(word.lower())
        w = {
            "id": f"{meta.get('prefix', meta['id'][:3])}_{slug(word)}",
            "word": word,
            "pos": pos,
            "ipa": ipa,
            "level": lvl.upper() if lvl else "TOEIC",
            "meaning": meaning,
            "definition": definition,
            "collocations": [c.strip() for c in colls.split(";") if c.strip()],
            "examples": [{"en": ex_en, "vi": ex_vi}],
        }
        if note:
            w["note"] = note
        if syn:
            w["synonyms"] = [s.strip() for s in syn.split(";") if s.strip()]
        words.append(w)
    return meta, words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--oxford")
    ap.add_argument("--pool", help="danh sách từ cần phủ (để báo cáo độ phủ)")
    args = ap.parse_args()
    oxford = load_oxford(args.oxford)

    errors = []
    # Từ đã có trong các chủ đề viết tay (không có file nguồn .txt).
    generated = {p.stem for p in SRC.glob("*.txt")}
    seen = {}
    for p in sorted(OUT.glob("*.json")):
        if p.stem in generated:
            continue
        for w in json.loads(p.read_text(encoding="utf-8")).get("words", []):
            seen[w["word"].lower()] = p.name

    total = 0
    levels = {}
    for path in sorted(SRC.glob("*.txt")):
        meta, words = parse(path, oxford, errors)
        kept = []
        ids = set()
        for w in words:
            k = w["word"].lower()
            if k in seen:
                errors.append(f"{path.name}: trùng từ '{w['word']}' (đã có trong {seen[k]})")
                continue
            if w["id"] in ids:
                w["id"] += "_2"
            ids.add(w["id"])
            seen[k] = path.name
            kept.append(w)
            levels[w["level"]] = levels.get(w["level"], 0) + 1
        counts = {}
        for w in kept:
            counts[w["level"]] = counts.get(w["level"], 0) + 1
        topic_level = max(counts, key=counts.get) if counts else "B2"
        doc = {
            "id": meta["id"],
            "order": int(meta.get("order", 99)),
            "icon": meta.get("icon", "📘"),
            "level": topic_level,
            "title": meta.get("title", meta["id"]),
            "title_vi": meta.get("title_vi", meta.get("title", meta["id"])),
            "description": meta.get("desc", ""),
            "words": kept,
            "phrases": [],
        }
        (OUT / f"{path.stem}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        total += len(kept)

    print(f"{len(list(SRC.glob('*.txt')))} chủ đề, {total} từ mới; theo cấp độ: {dict(sorted(levels.items()))}")
    print(f"Tổng số từ trong app: {len(seen)}")
    if args.pool:
        pool = [x["w"] for x in json.loads(Path(args.pool).read_text(encoding="utf-8"))]
        missing = [w for w in pool if w.lower() not in seen]
        print(f"Độ phủ danh sách: {len(pool) - len(missing)}/{len(pool)}; còn thiếu {len(missing)}")
        if missing:
            print("  " + " ".join(missing))
    for e in errors:
        print("LỖI:", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
