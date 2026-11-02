import re
import time
import threading
from datetime import datetime
import requests
from bs4 import BeautifulSoup

KAP_CACHE = []
# Daha önce detay sayfasına girilmiş bildirimlerin KAP linkini ve özetini hafızada tutar
DETAIL_CACHE = {}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://uzmanpara.milliyet.com.tr/",
}

BASE_URL = "https://uzmanpara.milliyet.com.tr"
LIST_URL = "https://uzmanpara.milliyet.com.tr/kap-haberleri/"


def clean_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def extract_time(text: str) -> str:
    m = re.search(r"(\d{2}:\d{2}:\d{2})", text)
    if m:
        return m.group(1)
    m2 = re.search(r"(\d{2}:\d{2})", text)
    if m2:
        return f"{m2.group(1)}:00"
    return datetime.now().strftime("%H:%M:%S")


def parse_code_and_title(raw_title: str):
    """
    Uzmanpara KAP başlık formatlarını ayrıştırır:
    Örn: "KAP: THYAO [TÜRK HAVA YOLLARI A.O.] ÖZEL DURUM AÇIKLAMASI (GENEL)"
    veya "THYAO - Şirket Açıklaması..."
    """
    t = clean_text(raw_title)
    t = re.sub(r"^KAP\s*:\s*", "", t, flags=re.IGNORECASE).strip()

    code = ""
    company = ""
    subject = t

    # 1. Köşeli parantez içinde şirket unvanı varsa: KOD [ŞİRKET UNVANI] KONU
    m_bracket = re.search(r"^([A-Z0-9,\s]*?)\s*\[(.*?)\]\s*(.*)$", t)
    if m_bracket:
        raw_codes = m_bracket.group(1).strip()
        company = m_bracket.group(2).strip()
        subject = m_bracket.group(3).strip() or company

        if raw_codes:
            first_c = raw_codes.split(",")[0].strip().upper()
            if 3 <= len(first_c) <= 7 and first_c.isalnum():
                code = first_c

    # 2. Köşeli parantez yoksa ilk kelime hisse kodu mu kontrol et
    if not code:
        m_first = re.match(r"^([A-Z0-9]{3,6})\b[\s\-:]*", t)
        if m_first:
            candidate = m_first.group(1).upper()
            if candidate not in ["KAP", "BIST", "SPK", "MKK", "ODA", "ÖDA"]:
                code = candidate
                rest = t[m_first.end():].strip()
                if rest:
                    subject = rest

    if not code:
        if "BORSA İSTANBUL" in t.upper() or "BIST" in t.upper():
            code = "BIST"
        elif "SERMAYE PİYASASI" in t.upper() or "SPK" in t.upper():
            code = "SPK"
        elif "MERKEZİ KAYIT" in t.upper() or "MKK" in t.upper():
            code = "MKK"
        else:
            code = "KAP"

    if not company:
        company = code

    # Bildirim tipi belirleme
    up_subj = subject.upper()
    disc_type = "ÖDA"
    if "FİNANSAL RAPOR" in up_subj or "FINANSAL RAPOR" in up_subj:
        disc_type = "FR"
    elif "DEVRE KESİCİ" in up_subj or "DEVRE KESICI" in up_subj:
        disc_type = "DK"
    elif "PAY ALIM" in up_subj or "PAY SATIM" in up_subj:
        disc_type = "PAY"

    return code, company, subject, disc_type


def fetch_kap_link_from_detail(detail_url: str):
    """
    Haber detay sayfasına girer ve en alttaki https://www.kap.org.tr/tr/Bildirim/... linkini alır.
    """
    if detail_url in DETAIL_CACHE:
        return DETAIL_CACHE[detail_url]

    kap_url = detail_url
    summary_text = ""

    try:
        res = requests.get(detail_url, headers=HEADERS, timeout=7)
        res.encoding = res.apparent_encoding or "utf-8"
        if res.status_code == 200:
            html = res.text
            soup = BeautifulSoup(html, "html.parser")

            # 1. Doğrudan <a> etiketlerinde kap.org.tr linki ara
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if "kap.org.tr" in href.lower():
                    kap_url = href
                    break

            # 2. Eğer düz metin olarak yazılmışsa regex ile yakala
            if "kap.org.tr" not in kap_url.lower():
                m_url = re.search(r"https?://(?:www\.)?kap\.org\.tr/[^\s\"'<>]+", html, re.IGNORECASE)
                if m_url:
                    kap_url = m_url.group(0).strip()

            # Detay metninden temiz özet çıkar
            content_div = (
                soup.find("div", class_=re.compile(r"detay|content|news-text|article", re.I))
                or soup.find("article")
            )
            if content_div:
                raw_p = clean_text(content_div.get_text(separator=" "))
                if len(raw_p) > 20:
                    summary_text = raw_p[:350]
    except Exception as e:
        print(f"[KAP Bot] Detay sayfası hatası ({detail_url}):", e)

    result = (kap_url, summary_text)
    DETAIL_CACHE[detail_url] = result
    return result


def fetch_uzmanpara_kap():
    disclosures = []
    try:
        res = requests.get(LIST_URL, headers=HEADERS, timeout=10)
        res.encoding = res.apparent_encoding or "utf-8"
        if res.status_code != 200:
            print("[KAP Bot] Uzmanpara liste sayfası durum kodu:", res.status_code)
            return disclosures

        soup = BeautifulSoup(res.text, "html.parser")

        # Uzmanpara KAP haberleri listesindeki linkleri topla
        candidate_links = []
        seen_urls = set()

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            title_text = clean_text(a_tag.get_text(separator=" "))

            # Sadece KAP bildirim detay linklerini filtrele
            if not title_text or len(title_text) < 10:
                continue

            is_kap_item = (
                "/kap-haberi/" in href
                or "/haber-detay/" in href
                or title_text.upper().startswith("KAP:")
                or "ÖZEL DURUM" in title_text.upper()
                or re.search(r"\[[A-Z0-9\s\.,]+\]", title_text)
            )

            if not is_kap_item:
                continue
            if href.rstrip("/") == LIST_URL.rstrip("/") or "javascript:" in href:
                continue

            full_url = href if href.startswith("http") else f"{BASE_URL}{href if href.startswith('/') else '/' + href}"
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            # Üst satırdan veya yan elemandan saati yakala
            parent_text = clean_text(a_tag.parent.get_text(separator=" ")) if a_tag.parent else title_text
            if a_tag.parent and a_tag.parent.parent:
                parent_text = clean_text(a_tag.parent.parent.get_text(separator=" "))

            time_str = extract_time(parent_text)

            # Satırda ayrıca hisse kodu sütunu varsa kontrol et
            explicit_code = ""
            if a_tag.parent:
                row_el = a_tag.find_parent("tr") or a_tag.find_parent("li") or a_tag.parent
                for tag in row_el.find_all(["span", "td", "strong", "b"]):
                    t_val = clean_text(tag.get_text()).upper()
                    if 3 <= len(t_val) <= 6 and t_val.isalpha() and t_val not in ["KAP", "BIST", "HABER", "DETAY"]:
                        explicit_code = t_val
                        break

            candidate_links.append({
                "title_raw": title_text,
                "detail_url": full_url,
                "time_str": time_str,
                "explicit_code": explicit_code,
            })

        # İlk 25 güncel bildirimi işle
        for idx, item in enumerate(candidate_links[:25]):
            code, company, subject, disc_type = parse_code_and_title(item["title_raw"])
            if item["explicit_code"] and code in ["KAP", "BIST"]:
                code = item["explicit_code"]

            # Detay sayfasından resmi kap.org.tr linkini al
            kap_url, detail_summary = fetch_kap_link_from_detail(item["detail_url"])

            # KAP linkinden veya detay linkinden benzersiz ID üret
            id_match = re.search(r"/Bildirim/(\d+)", kap_url, re.I) or re.search(r"(\d{6,9})", item["detail_url"])
            disc_id = int(id_match.group(1)) if id_match else (int(time.time() * 100) - idx)

            disclosures.append({
                "id": disc_id,
                "code": code,
                "type": disc_type,
                "title": company,
                "subject": subject,
                "summary": detail_summary if detail_summary else f"{company} — {subject}",
                "time": item["time_str"],
                "url": kap_url,
            })

        return disclosures

    except Exception as e:
        print("[KAP Bot] Uzmanpara scrape hatası:", e)
        return disclosures


def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            data = fetch_uzmanpara_kap()
            if data and len(data) > 0:
                KAP_CACHE = data
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] Uzmanpara üzerinden {len(KAP_CACHE)} KAP bildirimi çekildi.")
        except Exception as e:
            print("[KAP Bot] Worker hatası:", e)
        time.sleep(15)


def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()


def get_kap_data():
    return KAP_CACHE
