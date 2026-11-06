"""Yeni Şafak KAP news collector with an official KAP fallback.

Only links actually published by a source are accepted as disclosure IDs.
All network activity stays in the worker, never in the FastAPI request handler.
"""
import json
import html as html_lib
import logging
import re
import threading
import time
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup, NavigableString, UnicodeDammit

logger = logging.getLogger(__name__)
TR = timezone(timedelta(hours=3))
LIST_URL = "https://www.yenisafak.com/ekonomi/kap-haberleri"
KAP_CACHE = []
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BPTFinans/1.0)",
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
}
JUNK_KEYWORDS = (
    "ŞEMSİYE FON", "YATIRIMCI BİLGİ FORMU", "BORSA DIŞI REPO",
    "TERS REPO", "BORSA DIŞI VAAD", "FON İHRAÇ", "İZAHNAME (FON)",
)
_worker = None
_worker_lock = threading.Lock()


def clean_subject_text(text):
    text = re.sub(r"^KAP\s*[:\-—]\s*", "", text or "", flags=re.I).strip()
    text = re.sub(r"^[A-Z0-9,\s]*\[.*?\]\s*", "", text).strip()
    return re.sub(r"^[A-Z0-9]{3,6}\s*[\-—:]\s*", "", text).strip()


def official_link(value):
    """Validate host and exact disclosure path, rather than guessing an ID."""
    if not isinstance(value, str):
        return None
    value = decode_content(value).strip()
    if value.startswith("//"):
        value = "https:" + value
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ("kap.org.tr", "www.kap.org.tr"):
        return None
    match = re.fullmatch(r"/(?:(?:tr|en)/)?(?:Bildirim|disclosure)/(\d+)/?", parsed.path, re.I)
    if not match:
        return None
    return int(match[1]), f"https://www.kap.org.tr/tr/Bildirim/{int(match[1])}"


def decode_content(value):
    """Decode publisher HTML/URL/JSON escaping without evaluating scripts."""
    value = html_lib.unescape(value)
    value = value.replace("\\/", "/")
    value = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m[1], 16)), value)
    return unquote(value)


def extract_official_links(content):
    content = decode_content(content)
    links = []
    for value in re.findall(r'(?:https?:)?//(?:www\.)?kap\.org\.tr/[^\s<>"\'\\]+', content, re.I):
        link = official_link(value.rstrip(".,);]"))
        if link and link not in links:
            links.append(link)
    return links


def article_url(href):
    parsed = urlsplit(urljoin(LIST_URL, href))
    if parsed.scheme not in ("http", "https") or parsed.hostname != "www.yenisafak.com":
        return None
    path = parsed.path.rstrip("/")
    # Stay within the KAP section; do not crawl general economy/navigation links.
    if not re.fullmatch(r"/ekonomi/kap-haberleri/[^/]+-\d+", path):
        return None
    return urlunsplit(("https", "www.yenisafak.com", path, "", ""))


def json_nodes(soup):
    def walk(obj):
        if isinstance(obj, dict):
            yield obj
            for value in obj.values():
                yield from walk(value)
        elif isinstance(obj, list):
            for value in obj:
                yield from walk(value)
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            yield from walk(json.loads(script.string or script.get_text()))
        except (ValueError, TypeError):
            logger.warning("[KAP] Geçersiz JSON-LD kaydı atlandı")


def parse_listing(html):
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for anchor in soup.select("a[href]"):
        url = article_url(anchor["href"])
        if url and url not in urls:
            urls.append(url)
    for node in json_nodes(soup):
        for key in ("url", "item"):
            value = node.get(key)
            if isinstance(value, str):
                url = article_url(value)
                if url and url not in urls:
                    urls.append(url)
    return urls[:40]


def decode_response_html(response):
    # requests defaults text/html without a charset to Latin-1, corrupting UTF-8
    # Turkish text before BeautifulSoup ever sees the document.
    try:
        return response.content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = UnicodeDammit(response.content, is_html=True)
        if decoded.unicode_markup is None:
            raise ValueError("Haber sayfasının karakter kodlaması çözülemedi")
        return decoded.unicode_markup


def article_content(article):
    """Return ordered text/table blocks; never send publisher HTML to React."""
    blocks = []
    pending = []

    def flush():
        text = re.sub(r"[^\S\n]+", " ", "".join(pending)).strip()
        pending.clear()
        if text and text != "-KAP-" and not extract_official_links(text):
            blocks.append({"type": "text", "text": text})

    def span(cell, name):
        try:
            return max(1, min(100, int(cell.get(name, 1))))
        except (ValueError, TypeError):
            return 1

    def walk(node):
        if isinstance(node, NavigableString):
            pending.append(str(node))
            return
        if node.name in ("script", "style", "noscript"):
            return
        if node.name == "table":
            flush()
            rows = []
            for row in node.find_all("tr"):
                if row.find_parent("table") is not node:
                    continue
                cells = [{"text": cell.get_text(" ", strip=True),
                          "header": cell.name == "th",
                          "colSpan": span(cell, "colspan"),
                          "rowSpan": span(cell, "rowspan")}
                         for cell in row.find_all(["td", "th"], recursive=False)]
                if cells:
                    rows.append(cells)
            if rows:
                caption = node.find("caption", recursive=False)
                blocks.append({"type": "table", "rows": rows,
                               "caption": caption.get_text(" ", strip=True) if caption else ""})
            return
        if node.name == "br":
            pending.append("\n")
            return
        boundary = node.name in ("div", "p", "li", "h2", "h3", "h4", "section")
        if boundary:
            flush()
        for child in node.children:
            walk(child)
        if boundary:
            flush()

    # Tables can be siblings of .detail-text paragraphs. Select both, but walk
    # only the outermost matches to avoid duplicating nested paragraphs/tables.
    candidates = article.select(".detail-text, table")
    candidate_ids = {id(node) for node in candidates}
    for node in candidates:
        if not any(id(parent) in candidate_ids for parent in node.parents):
            walk(node)
            flush()
    return blocks


def parse_article(html, source_url):
    soup = BeautifulSoup(html, "html.parser")
    # Yeni Şafak's <article class="detail-head"> contains only the heading.
    # The actual disclosure text/link are siblings inside .detail-layout.
    article = soup.select_one(".detail-layout") or soup.find("article") or soup.find("main") or soup
    nodes = list(json_nodes(soup))
    metadata = next((n for n in nodes if "headline" in n), {})
    title_node = article.find("h1") or soup.find("h1")
    title = (metadata.get("headline") or (title_node.get_text(" ", strip=True) if title_node else ""))
    if not isinstance(title, str) or not title.strip():
        return []
    # Restrict text matching to article content to avoid header/footer ticker symbols.
    body = metadata.get("articleBody") or article.get_text(" ", strip=True)
    if not isinstance(body, str):
        body = article.get_text(" ", strip=True)
    if any(word in title.upper() for word in JUNK_KEYWORDS):
        return []
    # Search actual article markup too: URLs can be HTML-escaped text, data
    # attributes or embedded content, not necessarily an <a href> element.
    links = extract_official_links(str(article))
    for anchor in article.select("a[href]"):
        link = official_link(urljoin(source_url, anchor["href"]))
        if link and link not in links:
            links.append(link)
    # Some publishers print the official URL as text rather than an anchor.
    for link in extract_official_links(body):
        if link not in links:
            links.append(link)
    if not links:
        logger.warning("[KAP] Haberde resmî bildirim bağlantısı bulunamadı: %s", source_url)
        return []
    # Explicit labels/formats only: never infer an exchange symbol from an arbitrary word.
    match = re.search(r"\bBIST\s*:\s*([A-Z0-9]{3,6})\b", body)
    if not match:
        match = re.search(r"(?:Hisse Kodu|İlgili Şirketler|İlgili Hisseler|Borsa Kodu)\s*[:：]?\s*\[?([A-Z0-9]{3,6})\b", body)
    if not match:
        match = re.search(r"\(([A-Z0-9]{3,6})\)", title)
    if not match:
        match = re.search(r"\b([A-Z0-9]{3,6})\s*\[", title)
    if not match:
        match = re.search(r"\[([A-Z0-9]{3,6})\]", body)
    code = match[1] if match else ""
    company = ""
    subject = clean_subject_text(title)
    publisher_title = re.fullmatch(r"KAP\s*\*{3}\s*(.*?)\s*\*{3}\s*([A-Z0-9]{3,6}(?:\s*,\s*[A-Z0-9]{3,6})*)\s*\*{3}\s*(.+)", title.strip(), re.S)
    if publisher_title:
        company, code, subject = (part.strip() for part in publisher_title.groups())
    raw_date = metadata.get("datePublished", "")
    if not raw_date:
        meta = soup.select_one('meta[property="article:published_time"]')
        date_node = article.find("time")
        raw_date = meta.get("content", "") if meta else (date_node.get("datetime", "") if date_node else "")
    if not raw_date:
        # Site uses visible Turkish date text, not a <time datetime> element.
        for node in article.select(".detail-head-meta-primary .detail-head-text"):
            match_date = re.search(r"(\d{2}:\d{2}(?::\d{2})?),\s*(\d{2}/\d{2}/\d{4})", node.get_text(" ", strip=True))
            if match_date:
                fmt = "%H:%M:%S %d/%m/%Y" if len(match_date[1]) == 8 else "%H:%M %d/%m/%Y"
                raw_date = datetime.strptime(f"{match_date[1]} {match_date[2]}", fmt).replace(tzinfo=TR).isoformat()
                break
    published = None
    try:
        published = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        if published.tzinfo is None:
            published = published.replace(tzinfo=TR)
        published = published.astimezone(TR)
    except (ValueError, TypeError):
        pass  # Unknown publication time is never replaced with the current time.
    description = soup.select_one('meta[name="description"]')
    summary = metadata.get("description") or (description.get("content", "") if description else "") or title
    content = article_content(article)
    if content:
        summary = "\n".join(block["text"] if block["type"] == "text" else
                            "\n".join("\t".join(cell["text"] for cell in row) for row in block["rows"])
                            for block in content)
    return [{
        "id": disc_id, "code": code, "type": "KAP", "company": company,
        "title": subject, "subject": subject, "summary": summary, "content": content,
        "time": published.strftime("%H:%M:%S") if published else "--:--",
        "date": published.isoformat() if published else None,
        "timestamp": int(published.timestamp()) if published else None,
        "url": link, "link": link, "kapUrl": link,
        "source": "Yeni Şafak", "sourceUrl": source_url,
    } for disc_id, link in links]


class YeniSafakCollector:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.cache = {}  # url -> (retry_after, parsed records)

    def get_html(self, url):
        response = self.session.get(url, timeout=(5, 15))
        response.raise_for_status()
        if urlsplit(response.url).hostname != "www.yenisafak.com":
            raise ValueError("Yeni Şafak dışına yönlendirme reddedildi")
        return decode_response_html(response)

    def fetch(self):
        urls = parse_listing(self.get_html(LIST_URL))
        if not urls:
            raise ValueError("Yeni Şafak listesinde haber bağlantısı bulunamadı; sayfa yapısını kontrol edin")
        records = {}
        now = time.monotonic()
        pending = 0
        for url in urls:
            cached = self.cache.get(url)
            if not cached or cached[0] <= now:
                # Bound request volume and cycle duration. Older links wait for next poll.
                if pending >= 8:
                    continue
                pending += 1
                try:
                    items = parse_article(self.get_html(url), url)
                    self.cache[url] = (now + (3600 if items else 300), items)
                except (requests.RequestException, ValueError) as exc:
                    logger.warning("[KAP] Haber alınamadı %s: %s", url, exc)
                    self.cache[url] = (now + 300, cached[1] if cached else [])
                time.sleep(0.3)
            for item in self.cache[url][1]:
                records[item["id"]] = item
        self.cache = {url: value for url, value in self.cache.items() if url in urls}
        if not records:
            logger.warning("[KAP] Liste okundu ama resmî KAP bağlantısı içeren kayıt elde edilemedi")
        return sorted(records.values(), key=lambda item: item["id"], reverse=True)[:40]


_collector = YeniSafakCollector()


def fetch_official_kap():
    response = requests.get("https://www.kap.org.tr/tr/api/disclosures", headers=HEADERS, timeout=(5, 15))
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError("KAP yanıtı beklenen JSON listesi değil")
    results = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        basic = item.get("basic", item)
        if not isinstance(basic, dict):
            continue
        disc_id = basic.get("disclosureIndex") or basic.get("disclosureId") or basic.get("id")
        title = basic.get("title") or basic.get("disclosureTitle") or ""
        if not str(disc_id).isdigit() or not isinstance(title, str) or not title:
            continue
        if any(word in title.upper() for word in JUNK_KEYWORDS):
            continue
        code = basic.get("stockCodes") or basic.get("stockCode") or ""
        if isinstance(code, list):
            code = ",".join(str(value) for value in code)
        link = f"https://www.kap.org.tr/tr/Bildirim/{int(disc_id)}"
        raw_date = str(basic.get("publishDate") or basic.get("disclosureTime") or "")
        clock = re.search(r"\b\d{2}:\d{2}(?::\d{2})?\b", raw_date)
        results[int(disc_id)] = {
            "id": int(disc_id), "code": str(code), "type": "KAP",
            "title": clean_subject_text(title), "subject": clean_subject_text(title),
            "summary": basic.get("summary") or title,
            "company": basic.get("companyTitle") or basic.get("companyName") or "",
            "time": clock[0] if clock else "--:--", "url": link, "link": link,
            "kapUrl": link, "source": "KAP",
        }
    return sorted(results.values(), key=lambda item: item["id"], reverse=True)[:40]


def fetch_fast_kap():
    try:
        results = _collector.fetch()
        if results:
            return results
    except (requests.RequestException, ValueError) as exc:
        logger.warning("[KAP] Yeni Şafak kaynağı alınamadı: %s", exc)
    try:
        return fetch_official_kap()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("[KAP] Resmî kaynak alınamadı: %s", exc)
        return []


def run_kap_worker():
    global KAP_CACHE
    failures = 0
    while True:
        try:
            data = fetch_fast_kap()
            if data:
                KAP_CACHE = data
                failures = 0
                # Uvicorn does not necessarily configure this module's INFO logger.
                # Keep successful ingestion visible in hosting-provider logs too.
                print(f"[KAP] {len(data)} bildirim güncellendi; kaynak: {data[0].get('source', 'KAP')}", flush=True)
            else:
                failures += 1
        except Exception:
            failures += 1
            logger.exception("[KAP] Worker hatası; son başarılı veriler korunuyor")
        time.sleep(min(60 * (2 ** min(failures, 3)), 480))


def start_kap_bot():
    global _worker
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=run_kap_worker, name="kap-worker", daemon=True)
            _worker.start()


def get_kap_data():
    return KAP_CACHE
