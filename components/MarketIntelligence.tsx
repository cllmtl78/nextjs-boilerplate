"use client";

import { useState, useEffect } from "react";

interface StockMover {
  symbol: string;
  price: number;
  changePercent: number;
  volumeStr: string;
  isUp: boolean;
}

interface SectorItem {
  code: string;
  name: string;
  change: number;
}

export interface EconomicCalendarItem {
  id: string;
  title: string;
  country: "TR" | "US" | "EU" | "CN" | "JP";
  date: string;
  time: string;
  timestamp: number;
  actual: string | number | null;
  forecast: string | number | null;
  previous: string | number | null;
  importance: number;
  isCompleted: boolean;
}


const CACHE_CALENDAR_DATE = "bpt_calendar_date";
const CACHE_CALENDAR_DATA = "bpt_calendar_data";

// İngilizce gösterge isimlerini finansal Türkçe terminolojiye dönüştür
const translateIndicatorTitle = (title: string): string => {
  if (!title) return "Ekonomik Gösterge";
  const map: [RegExp, string][] = [
    [/Republic Day/i, "29 Ekim Cumhuriyet Bayramı"],
    [/Consumer Confidence Final/i, "Tüketici Güven Endeksi (Nihai)"],
    [/Consumer Confidence/i, "Tüketici Güveni Endeksi"],
    [/Initial Jobless Claims/i, "İşsizlik Maaşı Başvuruları"],
    [/Continuing Jobless Claims/i, "Devam Eden İşsizlik Başvuruları"],
    [/GDP Growth Rate|GDP/i, "GSYİH Büyüme Oranı"],
    [/Inflation Rate|CPI/i, "TÜFE Enflasyon Oranı"],
    [/Core PCE Price Index/i, "Çekirdek PCE Fiyat Endeksi"],
    [/PCE Price Index/i, "PCE Fiyat Endeksi"],
    [/Interest Rate Decision/i, "Faiz Oranı Kararı"],
    [/Manufacturing PMI/i, "İmalat PMI Endeksi"],
    [/Services PMI/i, "Hizmet PMI Endeksi"],
    [/Composite PMI/i, "Bileşik PMI Endeksi"],
    [/Retail Sales/i, "Perakende Satışlar"],
    [/Crude Oil Inventories/i, "Ham Petrol Stokları"],
    [/Non Farm Payrolls|NFP/i, "Tarım Dışı İstihdam (NFP)"],
    [/Unemployment Rate/i, "İşsizlik Oranı"],
    [/Trade Balance/i, "Dış Ticaret Dengesi"],
    [/Industrial Production/i, "Sanayi Üretimi"],
    [/Building Permits/i, "İnşaat İzinleri"],
    [/Housing Starts/i, "Konut Başlangıçları"],
    [/Current Account/i, "Cari Denge"],
    [/Wholesale Inventories/i, "Toptan Satış Stokları"],
    [/Business Confidence/i, "İş Dünyası Güven Endeksi"],
    [/3-Month Bill Auction/i, "3 Aylık Hazine Bonosu İhalesi"],
    [/2-Year JGB Auction/i, "2 Yıllık Devlet Tahvili İhalesi"],
    [/Selling Price Expectations/i, "Satış Fiyatı Beklentileri"],
    [/Services Sentiment/i, "Hizmet Sektörü Güveni"],
    [/Industrial Sentiment/i, "Sanayi Güveni"],
    [/Consumer Inflation Expectations/i, "Tüketici Enflasyon Beklentisi"],
    [/Communist Party Fifth Plenum/i, "Çin Komünist Partisi Genel Kurulu"],
  ];
  for (const [regex, tr] of map) {
    if (regex.test(title)) return tr;
  }
  return title;
};

// ... (truncated in this example for brevity, but in real call full content is used)
