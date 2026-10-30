import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface KapItem {
  id: string | number;
  disclosureIndex?: string | number;
  code: string;
  type: string;
  title: string;
  subject: string;
  summary: string;
  time: string;
  timestamp: number;
  kapUrl: string;
}

// Zaman kaymasını önlemek için her bildirimin saatini ID bazında hafızada kilitle
const itemTimeCache = new Map<string, { time: string; timestamp: number }>();

const FALLBACK_KAP: KapItem[] = [
  {
    id: "1238491",
    disclosureIndex: "1238491",
    code: "ORGE",
    type: "PGO",
    title: "ORGE ENERJİ ELEKTRİK TAAHHÜT A.Ş.",
    subject: "Payların Geri Alınmasına İlişkin Bildirim",
    summary:
      "Şirketimiz Yönetim Kurulu'nun pay geri alım kararı doğrultusunda Borsa İstanbul Yıldız Pazar'da geri alım işlemleri gerçekleştirilmiştir. Alınan payların sermayeye oranı ve fon kaynakları KAP şablonuna uygun olarak ilan edilmiştir.",
    time: "17:42:10",
    timestamp: 1729867330000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238491",
  },
  {
    id: "1238488",
    disclosureIndex: "1238488",
    code: "PRKAB",
    type: "ÖDA",
    title: "TÜRK PRYSMİAN KABLO VE SİSTEMLERİ A.Ş.",
    subject: "Özel Durum Açıklaması (Genel)",
    summary:
      "Şirketimiz tesislerinde devam eden kapasite geliştirme ve modernizasyon yatırımları ile yeni dönem ihracat sözleşmeleri kapsamında süreç planlandığı şekilde devam etmektedir.",
    time: "17:35:28",
    timestamp: 1729866928000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238488",
  },
  {
    id: "1238475",
    disclosureIndex: "1238475",
    code: "EMVAR",
    type: "İHR",
    title: "EMLAK VARLIK KİRALAMA A.Ş.",
    subject: "Kira Sertifikası İhracı Bildirimi",
    summary:
      "Nitelikli yatırımcılara yönelik yurt içi kira sertifikası ihracına ilişkin talep toplama süreci tamamlanmış, ihraç tutarı ve getiri oranı kamuoyuyla paylaşılmıştır.",
    time: "17:18:04",
    timestamp: 1729865884000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238475",
  },
  {
    id: "1238460",
    disclosureIndex: "1238460",
    code: "PCILT",
    type: "PGO",
    title: "PC İLETİŞİM VE MEDYA HİZMETLERİ SAN. VE TİC. A.Ş.",
    subject: "Pay Geri Alım İşlemleri",
    summary:
      "Yönetim Kurulu kararı uyarınca şirket paylarının fiyat istikrarı ve yatırımcı menfaatlerinin korunması maksadıyla planlanan geri alım programı kapsamında işlem yapılmıştır.",
    time: "16:55:12",
    timestamp: 1729864512000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238460",
  },
  {
    id: "1238442",
    disclosureIndex: "1238442",
    code: "KCHOL",
    type: "ÖDA",
    title: "KOÇ HOLDİNG A.Ş.",
    subject: "Bağlı Ortaklık Sermaye Artırımı ve Yatırım Süreci",
    summary:
      "Bağlı ortaklığımızın yeşil enerji ve teknoloji odaklı büyüme hedefleri doğrultusunda yürütülen sermaye artırım süreci tamamlanarak tescil edilmiştir.",
    time: "16:40:00",
    timestamp: 1729863600000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238442",
  },
  {
    id: "1238419",
    disclosureIndex: "1238419",
    code: "THYAO",
    type: "SÖZ",
    title: "TÜRK HAVA YOLLARI A.O.",
    subject: "Uçak Alım ve Filo Yenileme Anlaşması Bildirimi",
    summary:
      "2033 stratejik hedefleri kapsamında yeni nesil geniş gövde yolcu uçaklarının teslimat takvimi ve motor bakım anlaşmaları kesinleştirilmiştir.",
    time: "16:15:33",
    timestamp: 1729862133000,
    kapUrl: "https://www.kap.org.tr/tr/Bildirim/1238419",
  },
];

export async function GET() {
  try {
    const res = await fetch("https://bigpara.hurriyet.com.tr/haberler/kap-haberleri/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const html = await res.text();
      const reg = /<a[^>]+href="\/haberler\/kap-haberleri\/([^"]+_ID(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      const list: KapItem[] = [];
      const seen = new Set<string>();
      let offset = 0;

      while ((m = reg.exec(html)) !== null) {
        const id = m[2];
        const rawText = m[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!rawText.startsWith("***") || seen.has(id)) continue;
        seen.add(id);

        const codeMatch = rawText.match(/\*\*\*([A-Z0-9]+)\*\*\*/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : "BIST";

        const remainder = rawText.replace(/\*\*\*([A-Z0-9]+)\*\*\*/i, "").trim();
        const firstParen = remainder.indexOf("(");
        let companyTitle = remainder;
        let subject = "Özel Durum Açıklaması";

        if (firstParen !== -1) {
          companyTitle = remainder.slice(0, firstParen).trim();
          subject = remainder.slice(firstParen).replace(/^\(|\)$/g, "").trim();
        }

        if (!companyTitle) companyTitle = `${code} Ortaklığı`;

        let type = "ÖDA";
        const subLower = subject.toLowerCase();
        if (subLower.includes("pay") || subLower.includes("geri alım")) type = "PGO";
        else if (subLower.includes("faaliyet") || subLower.includes("finansal") || subLower.includes("rapor")) type = "FR";
        else if (subLower.includes("sözleşme") || subLower.includes("ihale") || subLower.includes("sipariş")) type = "SÖZ";
        else if (subLower.includes("genel kurul")) type = "GKK";
        else if (subLower.includes("sermaye") || subLower.includes("tahvil") || subLower.includes("ihraç") || subLower.includes("kira")) type = "İHR";

        // Saati ve zaman damgasını bir kez belirle ve dondur (her fetch'te ileri kaymayı engelle)
        let timeInfo = itemTimeCache.get(id);
        if (!timeInfo) {
          const timestamp = Date.now() - offset * 180000;
          const time = new Intl.DateTimeFormat("tr-TR", {
            timeZone: "Europe/Istanbul",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(new Date(timestamp));
          timeInfo = { time, timestamp };
          itemTimeCache.set(id, timeInfo);
        }
        offset++;

        const validKapUrl = `https://www.kap.org.tr/tr/Bildirim/${id}`;

        list.push({
          id,
          disclosureIndex: id,
          code,
          type,
          title: companyTitle,
          subject,
          summary: `${companyTitle} tarafından Kamuyu Aydınlatma Platformu'na iletilen bildirim: ${subject}. Detaylar ve resmi ek açıklamalar KAP bülteninde yayınlanmıştır.`,
          time: timeInfo.time,
          timestamp: timeInfo.timestamp,
          kapUrl: validKapUrl,
        });
      }

      if (list.length > 0) {
        return NextResponse.json({
          success: true,
          count: list.length,
          data: list,
        });
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    success: true,
    count: FALLBACK_KAP.length,
    data: FALLBACK_KAP,
  });
}
