"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDownToLine, ImagePlus, RotateCcw, ShieldCheck } from "lucide-react";
import { blobDataUrl, buildPostBackground, DEFAULT_DESCRIPTION, drawPost, POST_HEIGHT, POST_WIDTH, prepareUploadedPhoto } from "@/lib/post-designer";
import styles from "./PostDesigner.module.css";

export default function PostDesigner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<{ template: string; background: HTMLImageElement } | null>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [location, setLocation] = useState("DÜNYA");
  const [photoName, setPhotoName] = useState("Şablondaki fotoğraf");
  const [busy, setBusy] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setBusy(true); setError("");
      try {
        const [templateResponse, photoResponse] = await Promise.all([fetch("/post-template/template.svg"), fetch("/post-template/default-photo.webp")]);
        if (!templateResponse.ok || !photoResponse.ok) throw new Error("Şablon yüklenemedi. Bağlantını kontrol edip tekrar dene.");
        const [template, photo] = await Promise.all([templateResponse.text(), photoResponse.blob().then(blobDataUrl)]);
        await Promise.all([400, 500, 700].map(weight => document.fonts.load(`${weight} 39px "BPT Rubik"`)));
        if (![400, 500, 700].every(weight => document.fonts.check(`${weight} 39px "BPT Rubik"`))) throw new Error("Rubik yazı tipi yüklenemedi. Tekrar dene.");
        const image = await buildPostBackground(template, { data: photo, original: true });
        if (!disposed) { assetsRef.current = { template, background: image }; setBackground(image); }
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "Şablon hazırlanamadı."); }
      finally { if (!disposed) setBusy(false); }
    };
    void load();
    return () => { disposed = true; };
  }, [retry]);

  useEffect(() => {
    if (!background) return;
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      try { setOverflow(drawPost(canvasRef.current, background, description, location).overflow); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Önizleme hazırlanamadı."); }
    });
    return () => cancelAnimationFrame(frame);
  }, [background, description, location]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !assetsRef.current) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const photo = await prepareUploadedPhoto(file);
      const image = await buildPostBackground(assetsRef.current.template, photo);
      setBackground(image); setPhotoName(file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fotoğraf değiştirilemedi."); }
    finally { setBusy(false); }
  };
  const reset = () => {
    setDescription(DEFAULT_DESCRIPTION); setLocation("DÜNYA"); setPhotoName("Şablondaki fotoğraf");
    if (assetsRef.current) setBackground(assetsRef.current.background);
    setError(""); setMessage("");
  };
  const download = async () => {
    if (!canvasRef.current || !background || busy || overflow) return;
    setExporting(true); setError(""); setMessage("");
    try {
      const result = drawPost(canvasRef.current, background, description, location);
      if (result.overflow) { setOverflow(true); return; }
      const canvas = canvasRef.current;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG oluşturulamadı.")), "image/png"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `bpt-finans-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("PNG hazır. Telefonunda İndirilenler / Dosyalar bölümünden açabilirsin.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Görsel indirilemedi."); }
    finally { setExporting(false); }
  };

  return <div className={styles.designer}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>BPT FİNANS / TASARIM</span><h1>Haberini hazırla.</h1><p>Fotoğrafı ve metni değiştir. BPT imzası aynı kalsın.</p></div><span className={styles.dimensions}>1080 × 1350 <span>PNG</span></span></div>
    <div className={styles.layout}>
      <section className={styles.preview} aria-label="Post önizlemesi">
        <div className={styles.previewHeading}><span>CANLI ÖNİZLEME</span><span>4:5</span></div>
        <div className={styles.canvasWrap} aria-busy={busy}>
          <canvas ref={canvasRef} width={POST_WIDTH} height={POST_HEIGHT} aria-label={`BPT Finans postu. Konum: ${location}. ${description}`}>Post önizlemesi için güncel bir tarayıcı kullan.</canvas>
          {busy && <div className={styles.loading} role="status">Tasarım hazırlanıyor…</div>}
        </div>
        <p className={styles.previewNote}><ShieldCheck size={13} aria-hidden="true" />Logo, sol şerit ve mavi efekt sabit.</p>
      </section>
      <section className={styles.controls} aria-label="Post düzenleme alanları">
        <div className={styles.field}><label htmlFor="post-photo"><span>01</span>Haber fotoğrafı</label><input ref={fileRef} id="post-photo" className={styles.file} tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event)} disabled={busy} /><button type="button" className={styles.upload} disabled={busy || !background} onClick={() => fileRef.current?.click()}><ImagePlus size={21} aria-hidden="true" /><span>Fotoğraf seç<small>{photoName}</small></span></button><p>JPG, PNG veya WebP · En fazla 20 MB. Fotoğraf çerçeveyi ortalayarak doldurur.</p></div>
        <div className={styles.field}><label htmlFor="post-description"><span>02</span>Haber açıklaması</label><textarea id="post-description" value={description} onChange={event => { setDescription(event.target.value); setMessage(""); }} rows={8} maxLength={1800} spellCheck={false} /><p>İlk paragraf Rubik Bold. Boş satırdan sonraki bölüm Rubik Regular. Yazı boyutu otomatik ayarlanır.</p>{overflow && <p className={styles.warning} role="alert">Metin tasarıma sığmıyor. PNG indirmek için açıklamayı biraz kısalt.</p>}</div>
        <div className={styles.field}><label htmlFor="post-location"><span>03</span>Konum</label><input id="post-location" type="text" value={location} maxLength={24} onChange={event => { setLocation(event.target.value); setMessage(""); }} placeholder="DÜNYA" /><p>Sol beyaz şeritte Rubik Medium ile görünür.</p></div>
        {error && <div className={styles.error} role="alert">{error}{!background && <button type="button" onClick={() => setRetry(value => value + 1)} disabled={busy}>Tekrar dene</button>}</div>}
        {message && <p className={styles.success} role="status">{message}</p>}
        <div className={styles.actions}><button type="button" className={styles.download} disabled={busy || exporting || overflow || !background} onClick={() => void download()}><ArrowDownToLine size={16} aria-hidden="true" />{exporting ? "PNG hazırlanıyor…" : "PNG indir"}</button><button type="button" className={styles.reset} disabled={busy || !background} onClick={reset}><RotateCcw size={14} aria-hidden="true" />Sıfırla</button></div>
        <p className={styles.privacy}>Fotoğrafın cihazında işlenir; sunucuya yüklenmez. Sayfadan ayrılınca düzenlemeler saklanmaz.</p>
      </section>
    </div>
  </div>;
}
