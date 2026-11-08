import os
from fred_macro import start_fred_macro_bot, get_macro_data, get_turkey_research
from tcmb_rates import get_tcmb_rates
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# İki bağımsız botu içeri al
from bist_news_bot import start_bist_news_bot, get_bist_news_data
from kap_bot import start_kap_bot, get_kap_data
from global_news_bot import start_global_news_bot, get_global_news_data
from crypto_news_bot import start_crypto_news_bot, get_crypto_news_data
from official_news_bot import start_official_news_bot, get_official_news_data, get_bpt_news_data

app = FastAPI(title="BPT Terminal Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Botları arka planda bağımsız olarak başlat
start_bist_news_bot()
start_kap_bot()
start_global_news_bot()
start_official_news_bot()
start_crypto_news_bot()
start_fred_macro_bot()

@app.get("/")
def health():
    return {
        "status": "running",
        "bist_news_count": len(get_bist_news_data()),
        "kap_count": len(get_kap_data())
    }

# 1. KUTU İÇİN:
@app.get("/api/bist-news")
def api_bist_news():
    data = get_bist_news_data()
    return {"status": "ok", "count": len(data), "data": data}

# 2. KUTU İÇİN:
@app.get("/api/kap")
def api_kap():
    data = get_kap_data()
    return {"status": "ok", "count": len(data), "data": data}


@app.get("/api/global-news")
def api_global_news():
    return get_global_news_data()


@app.get("/api/crypto-news")
def api_crypto_news():
    return get_crypto_news_data()


@app.get("/api/macro/turkey-series")
def api_turkey_series():
    return get_turkey_research()


@app.get("/api/macro")
def api_macro():
    return get_macro_data()


@app.get("/api/tcmb-rates")
def api_tcmb_rates():
    return get_tcmb_rates()


@app.get("/api/bpt-news")
def api_bpt_news():
    return get_bpt_news_data()


@app.get("/api/official-news")
def api_official_news():
    return get_official_news_data()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
