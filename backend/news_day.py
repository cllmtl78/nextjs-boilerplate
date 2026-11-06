"""Publication-date checks shared by news APIs. A clock alone is not a date."""
import math
import re
from datetime import datetime, timedelta, timezone

TR = timezone(timedelta(hours=3))


def publication_time(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=TR) if value.tzinfo is None else value.astimezone(TR)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or value <= 0:
            return None
        try:
            return datetime.fromtimestamp(value / 1000 if value >= 100_000_000_000 else value, TR)
        except (ValueError, OverflowError, OSError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if re.fullmatch(r"\d{10}|\d{13}", text):
        return publication_time(int(text))
    # Prevent datetime.fromisoformat from interpreting a clock or arbitrary text.
    if re.match(r"^\d{4}-\d{2}-\d{2}(?:$|[ T])", text):
        try:
            date = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return date.replace(tzinfo=TR) if date.tzinfo is None else date.astimezone(TR)
        except ValueError:
            return None
    for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=TR)
        except ValueError:
            continue
    return None


def is_today(item, now=None):
    today = (now or datetime.now(TR)).astimezone(TR).date()
    for field in ("timestamp", "date", "publishedAt", "dateObj"):
        published = publication_time(item.get(field))
        if published is not None:
            return published.date() == today
    return False


def only_today(items, now=None):
    return [item for item in items if is_today(item, now)]
