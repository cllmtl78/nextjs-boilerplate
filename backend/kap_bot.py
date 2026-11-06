import re
import time
import threading
from datetime import datetime, timezone, timedelta
import requests

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://tr.tradingview.com",
    "Referer": "https://tr.tradingview.com/",
}

# Fon, repo ve tahvil çöplerini engelleyen filtre
JUNK_KEYWORDS = [
    "ŞEMSİYE FON",
    "YATIRIMCI BİLGİ FORMU",
    "BORSA DIŞI REPO",
    "TERS REPO",
    "BORSA DIŞI VAAD",
    "FON İHRAÇ",
    "İZAHNAME (FON)",
]


def clean_subject_text(text: str) -> str:
    if not text:
        return ""
    # Başındaki "KAP —", "KAP:", "01285 —", "[ŞİRKET ADI]" gibi tüm fazlalıkları siler
    t = re.sub(r"^KAP\s*[:\-—]\s*", "", text, flags=re.IGNORECASE).strip()
    t = re.sub(r"^[A-Z0-9,\s]*\[.*?\]\s*", "", t).strip()
    t = re.sub(r"^[A-Z0-9]{3,6}\s*[\-—:]\s*", "", t).strip()
    return t


def fetch_fast_kap():
    tz_tr = timezone(timedelta(hours=3))
    results = []

    # 1. KAYNAK: Doğrudan KAP Canlı API (AllOrigins & Codetabs önbelleksiz anlık tünel)
    ts_now = int(time.time() * 1000)
    kap_api_urls = [
        f"https://www.kap.org.tr/tr/api/disclosures?_={ts_now}",
        f"https://api.codetabs.com/v1/proxy?quest=https://www.kap.org.tr/tr/api/disclosures",
    ]

    for api_url in kap_api_urls:
        try:
            res = requests.get(api_url, headers=HEADERS, timeout=7)
            if res.status_code == 200 and res.text.strip().startswith("["):
                data = res.json()
                for item in data:
                    basic = item.get("basic", item)
                    if not isinstance(basic, dict):
                        continue

                    disc_id = basic.get("disclosureIndex") or basic.get("disclosureId") or basic.get("id")
                    if not disc_id:
                        continue

                    # Hisse kodunu al
                    raw_code = basic.get("stockCodes") or basic.get("stockCode") or basic.get("relatedStocks") or ""
                    if isinstance(raw_code, list):
                        raw_code = raw_code[0] if raw_code else ""
                    code = str(raw_code).replace("[", "").replace("]", "").replace('"', "").split(",")[0].strip().upper()

                    # SADECE gerçek BIST hisse kodlarını kabul et (01285 gibi tahvil/repo kodlarını ve boş fonları atla)
                    if not code or not code.isalpha() or not (3 <= len(code) <= 6) or code == "KAP":
                        continue

                    subject = clean_subject_text(basic.get("title") or basic.get("disclosureTitle") or "")
                    if not subject:
                        continue

                    if any(junk in subject.upper() for junk in JUNK_KEYWORDS):
                        continue

                    summary = clean_subject_text(basic.get("summary") or subject)
                    company = (basic.get("companyTitle") or basic.get("companyName") or code).strip()
                    disc_type = (basic.get("disclosureClass") or "ÖDA").strip().upper()

                    raw_time = str(basic.get("publishDate") or basic.get("disclosureTime") or "")
                    m_time = re.search(r"(\d{2}:\d{2}:\d{2})", raw_time)
                    m_short = re.search(r"(\d{2}:\d{2})", raw_time)
                    time_str = m_time.group(1) if m_time else (f"{m_short.group(1)}:00" if m_short else datetime.now(tz_tr).strftime("%H:%M:%S"))

                    kap_link = f"https://www.kap.org.tr/tr/Bildirim/{disc_id}"

                    results.append({
                        "id": int(disc_id),
                        "code": code,
                        "type": disc_type,
                        "title": subject,       # Başında "KAP —" olmaması için doğrudan başlık
                        "subject": subject,
                        "company": company,
                        "summary": summary if summary else subject,
                        "time": time_str,
                        "url": kap_link,
                        "link": kap_link,       # Frontend'deki her iki prop adını da destekler
                    })

                if results:
                    results.sort(key=lambda x: x["id"], reverse=True)
                    return results[:40]
        except Exception as e:
            print("[KAP Bot] Doğrudan API tünel hatası:", e)

    # 2. KAYNAK: TradingView Gerçek Zamanlı KAP Stream (Sadece BIST Hisseleri)
    try:
        tv_url = f"https://news-headlines.tradingview.com/v2/view/headlines/symbol?client=web&lang=tr&market=TR&provider=kap&_={ts_now}"
        res_tv = requests.get(tv_url, headers=HEADERS, timeout=7)
        if res_tv.status_code == 200:
            items = res_tv.json().get("items", [])
            for idx, it in enumerate(items):
                raw_title = it.get("title", "")
                if any(junk in raw_title.upper() for junk in JUNK_KEYWORDS):
                    continue

                # Sembolden gerçek hisse kodunu al (Örn: BIST:THYAO -> THYAO)
                code = ""
                for sym_obj in it.get("relatedSymbols", []):
                    sym = sym_obj.get("symbol", "")
                    cand = sym.split(":")[-1].strip().upper()
                    if cand.isalpha() and 3 <= len(cand) <= 6 and cand != "KAP":
                        code = cand
                        break

                # Sembolde yoksa başlıktan yakala: "KAP: THYAO [TÜRK HAVA YOLLARI...]"
                if not code:
                    m_code = re.search(r"KAP:\s*([A-Z]{3,6})\b", raw_title)
                    if m_code and m_code.group(1) != "KAP":
                        code = m_code.group(1)

                # Hisse kodu olmayan (fon/repo/duyuru) bildirimleri tamamen atla
                if not code:
                    continue

                subject = clean_subject_text(raw_title)
                ts = it.get("published", int(time.time()))
                dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(tz_tr)
                time_str = dt.strftime("%H:%M:%S")

                # Resmi KAP Bildirim ID'si varsa al, yoksa KAP sorgu/bildirim linki ver
                raw_id = str(it.get("id", ""))
                m_kap_id = re.search(r"(\d{6,8})", raw_id)
                disc_id = int(m_kap_id.group(1)) if m_kap_id else (int(ts) * 100 + idx)

                story_path = it.get("storyPath", "")
                kap_link = (
                    f"https://www.kap.org.tr/tr/Bildirim/{m_kap_id.group(1)}"
                    if m_kap_id
                    else (f"https://tr.tradingview.com{story_path}" if story_path else "https://www.kap.org.tr/tr/")
                )

                results.append({
                    "id": disc_id,
                    "code": code,
                    "type": "ÖDA",
                    "title": subject,
                    "subject": subject,
                    "summary": subject,
                    "time": time_str,
                    "url": kap_link,
                    "link": kap_link,
                })

            if results:
                return results[:40]
    except Exception as e:
        print("[KAP Bot] TV Stream hatası:", e)

    return []


def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            data = fetch_fast_kap()
            if data:
                KAP_CACHE = data
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] {len(KAP_CACHE)} hisse KAP bildirimi güncellendi.")
        except Exception as e:
            print("[KAP Bot] Worker hatası:", e)
        # Saniyelik hız için 10 saniyede bir kontrol
        time.sleep(10)


def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()


def get_kap_data():
    return KAP_CACHE
