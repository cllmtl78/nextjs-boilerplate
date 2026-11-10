"""Conservative, one-to-one release matching. Eulerpool owns the schedule."""
import math
import re
from collections import defaultdict
from news_day import publication_time

MONTHS = {name: index for index, name in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
SCALES = {"k": 1000, "m": 1000000, "b": 1000000000, "t": 1000000000000}


def indicator(value):
    text = re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()
    text = re.sub(r"\bpreliminary\b", "prel", text)
    text = re.sub(r"\bnon farm\b", "nonfarm", text)
    text = re.sub(r"^(core )?cpi (yoy|mom|qoq)\b", lambda m: f"{m[1] or ''}inflation rate {m[2]}", text)
    text = re.sub(r"^export growth (yoy|mom)\b", r"exports \1", text)
    text = re.sub(r"^import growth (yoy|mom)\b", r"imports \1", text)
    # Do not remove YoY/MoM, core, SA/NSA, preliminary/final distinctions.
    return text


def period(value, published):
    text = str(value or "").strip().lower()
    if text in ("", "none", "null"):
        return None
    year_match = re.search(r"\b(20\d{2})\b", text)
    year = int(year_match[1]) if year_match else published.year
    quarter = re.search(r"\bq([1-4])\b", text)
    if quarter:
        q = int(quarter[1])
        if not year_match and (q - 1) * 3 + 1 > published.month:
            year -= 1
        return f"{year}-Q{q}"
    iso = re.match(r"^(20\d{2})-(\d{2})(?:-\d{2})?", text)
    if iso:
        return f"{iso[1]}-{iso[2]}"
    month = next((number for name, number in MONTHS.items() if re.search(rf"\b{name}[a-z.]*\b", text)), None)
    if month is None and re.fullmatch(r"\d{1,2}", text) and 1 <= int(text) <= 12:
        month = int(text)
    if month:
        if not year_match and month > published.month:
            year -= 1
        return f"{year}-{month:02}"
    if re.fullmatch(r"20\d{2}", text):
        return f"year:{text}"
    return None


def identity(row):
    return tuple(str(row.get(field)) for field in ("country_code", "timestamp", "name", "reference_date"))


def number(value):
    if isinstance(value, bool) or value is None or str(value).strip() == "":
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def result_fields(tv, euler):
    actual, raw = number(tv.get("actual")), number(tv.get("actualRaw"))
    if actual is None and raw is None:
        return None
    unit = str(tv.get("unit") or "").strip()
    currency = euler.get("actual_currency")
    if currency is None:
        currency = euler.get("previous_currency") or ""
    if unit == "%" and currency not in ("", "%"):
        return None
    currencies = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₺": "TRY",
                  "USD": "USD", "EUR": "EUR", "GBP": "GBP", "JPY": "JPY", "TRY": "TRY", "CNY": "CNY"}
    if unit in currencies and currency in currencies and currencies[unit] != currencies[currency]:
        return None
    tv_scale = SCALES.get(str(tv.get("scale") or "").lower(), SCALES.get(unit.lower(), 1))
    magnitude = tv_scale if tv_scale > 1 else number(euler.get("actual_multiplier")) or 1
    if magnitude == 1:
        magnitude = number(euler.get("previous_multiplier")) or 1
    base = raw if raw is not None else actual * tv_scale
    if magnitude <= 0:
        return None
    currency = unit if unit == "%" or unit in currencies else currency
    return {"actual_value": base / magnitude, "actual_multiplier": str(int(magnitude)),
            "actual_currency": currency, "actual_source": "tradingview"}


def merge_results(schedule, tradingview, previous=()):
    index = defaultdict(list)
    for i, tv in enumerate(tradingview):
        if not isinstance(tv, dict):
            continue
        stamp = publication_time(tv.get("date"))
        if stamp:
            key = (str(tv.get("country", "")).lower(), indicator(tv.get("title")), stamp.date())
            ref = period(tv.get("referencePeriod") or tv.get("period") or tv.get("referenceDate"), stamp)
            index[key].append((i, tv, stamp, ref))
    candidates, reverse = {}, defaultdict(set)
    for position, row in enumerate(schedule):
        stamp = publication_time(row.get("timestamp"))
        if not stamp:
            continue
        ref = period(row.get("reference_date"), stamp)
        key = (str(row.get("country_code", "")).lower(), indicator(row.get("name")), stamp.date())
        matches = []
        for i, tv, tv_stamp, tv_ref in index.get(key, []):
            if ref and tv_ref:
                if ref != tv_ref:
                    continue
            elif abs((stamp - tv_stamp).total_seconds()) > 900:
                continue
            matches.append((i, tv))
            reverse[i].add(identity(row))
        candidates[position] = matches
    known = {identity(row): row for row in previous}
    result, matched, updated = [], 0, 0
    for position, row in enumerate(schedule):
        merged = dict(row)
        old = known.get(identity(row), {})
        if number(row.get("actual_value")) is None and old.get("actual_source") == "tradingview":
            merged.update({key: old.get(key) for key in ("actual_value", "actual_multiplier", "actual_currency", "actual_source")})
        matches = candidates.get(position, [])
        if len(matches) == 1 and len(reverse[matches[0][0]]) == 1:
            matched += 1
            fields = result_fields(matches[0][1], row)
            if fields:
                merged.update(fields)
                updated += 1
        if merged.get("actual_source") is None and number(merged.get("actual_value")) is not None:
            merged["actual_source"] = "eulerpool"
        result.append(merged)
    return result, {"matched": matched, "updated": updated, "total": len(schedule)}
