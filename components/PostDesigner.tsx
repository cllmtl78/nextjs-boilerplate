"use client";

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { ArrowDownToLine, ImagePlus, RotateCcw } from "lucide-react";
import { blobDataUrl, buildPostOverlay, loadPostImage, DEFAULT_DESCRIPTION, DEFAULT_PHOTO_TRANSFORM, drawPost, POST_HEIGHT, POST_WIDTH, prepareUploadedPhoto, type ExtraPhoto, type PostScene, type PostTextRun, type PhotoTransform } from "@/lib/post-designer";
import PostTextEditor from "./PostTextEditor";
import ExtraPhotoControls from "./ExtraPhotoControls";
import styles from "./PostDesigner.module.css";

export default function PostDesigner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const downloadTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchDownloadRef = useRef(0);
  const assetsRef = useRef<PostScene | null>(null);
  const dragRef = useRef<{ x: number; y: number; original: PhotoTransform; target: "base" | "extra" } | null>(null);
  const [extraPhoto, setExtraPhoto] = useState<ExtraPhoto | null>(null);
  const [photoTarget, setPhotoTarget] = useState<"base" | "extra">("base");
  const [background, setBackground] = useState<PostScene | null>(null);
  const [photoTransform, setPhotoTransform] = useState<PhotoTransform>(DEFAULT_PHOTO_TRANSFORM);
  const [draggingEnabled, setDraggingEnabled] = useState(true);
  const [manual, setManual] = useState(false);
  const [decorations, setDecorations] = useState({ quote: false, swipe: false });
  const pendingTransform = useRef<PhotoTransform | null>(null);
  const dragFrame = useRef<number | null>(null);
  const [description, setDescription] = useState<PostTextRun[]>([{ text: DEFAULT_DESCRIPTION, bold: true }]);
  const [editorReset, setEditorReset] = useState(0);
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
        const [image, overlay, quote, swipe] = await Promise.all([loadPostImage(photo), buildPostOverlay(template), loadPostImage("/post-template/quote.svg"), loadPostImage("/post-template/swipe.svg")]);
        const scene = { photo: image, overlay, quote, swipe, original: true };
        if (!disposed) { assetsRef.current = scene; setBackground(scene); }
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
      try { setOverflow(drawPost(canvasRef.current, background, description, location, photoTransform, decorations, extraPhoto).overflow); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Önizleme hazırlanamadı."); }
    });
    return () => cancelAnimationFrame(frame);
  }, [background, description, location, photoTransform, decorations, extraPhoto]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !assetsRef.current) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const photo = await prepareUploadedPhoto(file);
      const image = await loadPostImage(photo.data);
      setBackground({ ...assetsRef.current, photo: image, original: false });
      setPhotoTransform(DEFAULT_PHOTO_TRANSFORM); setPhotoName(file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fotoğraf değiştirilemedi."); }
    finally { setBusy(false); }
  };
  const reset = () => {
    setDescription([{ text: DEFAULT_DESCRIPTION, bold: true }]); setEditorReset(value => value + 1); setLocation("DÜNYA"); setPhotoName("Şablondaki fotoğraf");
    if (assetsRef.current) setBackground(assetsRef.current);
    setPhotoTransform(DEFAULT_PHOTO_TRANSFORM); setDraggingEnabled(true); setManual(false); setDecorations({ quote: false, swipe: false });
    setExtraPhoto(null); setPhotoTarget("base");
    setError(""); setMessage("");
  };
  const changePhoto = (change: Partial<PhotoTransform>) => {
    setPhotoTransform(current => ({ ...current, ...change })); setMessage("");
  };
  const movePhoto = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || !draggingEnabled) return;
    const scale = POST_WIDTH / event.currentTarget.getBoundingClientRect().width;
    pendingTransform.current = { ...drag.original, x: Math.max(-POST_WIDTH, Math.min(POST_WIDTH, drag.original.x + (event.clientX - drag.x) * scale)), y: Math.max(-POST_HEIGHT, Math.min(POST_HEIGHT, drag.original.y + (event.clientY - drag.y) * scale)) };
    if (dragFrame.current === null) dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      if (canvasRef.current && background && pendingTransform.current) {
        const next = pendingTransform.current;
        drawPost(canvasRef.current, background, description, location, drag.target === "base" ? next : photoTransform, decorations, drag.target === "extra" && extraPhoto ? { ...extraPhoto, x: next.x, y: next.y } : extraPhoto);
      }
    });
  };
  const finishDrag = () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    if (pendingTransform.current) {
      const next = pendingTransform.current;
      if (dragRef.current?.target === "extra") setExtraPhoto(current => current ? { ...current, x: next.x, y: next.y } : null);
      else setPhotoTransform(next);
    }
    pendingTransform.current = null; dragRef.current = null;
  };
  useEffect(() => () => { if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current); }, []);
  const download = async () => {
    if (!canvasRef.current || !background || busy || exporting || overflow) return;
    setExporting(true); setError(""); setMessage("");
    try {
      const result = drawPost(canvasRef.current, background, description, location, photoTransform, decorations, extraPhoto);
      if (result.overflow) { setOverflow(true); return; }
      const canvas = canvasRef.current;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG oluşturulamadı.")), "image/png"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `bpt-finans-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("PNG indirildi");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Görsel indirilemedi."); }
    finally { setExporting(false); }
  };

  return <div className={styles.designer}>
    <div className={styles.heading}><span className={styles.eyebrow}>BPT FİNANS / TASARIM</span></div>
    <div className={styles.layout}>
      <div className={styles.leftColumn}>
      <section className={styles.preview} aria-label="Post önizlemesi">
        <div className={styles.canvasWrap} aria-busy={busy}>
          <canvas ref={canvasRef} width={POST_WIDTH} height={POST_HEIGHT} aria-label={`BPT Finans postu. Konum: ${location}. ${description.map(run => run.text).join("")}`}
            style={{ touchAction: draggingEnabled ? "none" : "auto", cursor: draggingEnabled ? "grab" : "default" }}
            onPointerDown={event => { if (!draggingEnabled || busy) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, original: photoTarget === "extra" && extraPhoto ? { zoom: 1, x: extraPhoto.x, y: extraPhoto.y } : photoTransform, target: photoTarget }; }}
            onPointerMove={movePhoto} onPointerUp={finishDrag} onPointerCancel={finishDrag}>Post önizlemesi için güncel bir tarayıcı kullan.</canvas>
          {busy && <div className={styles.loading} role="status">Tasarım hazırlanıyor…</div>}
        </div>
      </section>
      <section className={styles.photoPanel} aria-label="Fotoğraf ayarları">
        <div className={styles.field}><label htmlFor="post-photo"><span>01</span>Haber fotoğrafı</label><input ref={fileRef} id="post-photo" className={styles.file} tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event)} disabled={busy} /><button type="button" className={styles.upload} disabled={busy || !background} onClick={() => fileRef.current?.click()}><ImagePlus size={21} aria-hidden="true" /><span>Fotoğraf seç<small>{photoName}</small></span></button><p>JPG, PNG veya WebP · En fazla 20 MB.</p>
          <div className={styles.photoButtons}>
            <button type="button" disabled={busy} aria-pressed={draggingEnabled} onClick={() => setDraggingEnabled(value => !value)}>{draggingEnabled ? "Sürükleme açık" : "Sürükleme kapalı"}</button>
            <button type="button" disabled={busy} aria-expanded={manual} aria-controls="manual-photo-controls" onClick={() => setManual(value => !value)}>Manuel sürükle</button>
          </div>
          {manual && <div id="manual-photo-controls" className={styles.photoControls}>
            <label htmlFor="photo-zoom">Yakınlık <output>{Math.round(photoTransform.zoom * 100)}%</output></label><input id="photo-zoom" type="range" min="50" max="300" value={Math.round(photoTransform.zoom * 100)} disabled={busy} onChange={event => changePhoto({ zoom: Number(event.target.value) / 100 })} />
            <label htmlFor="photo-x">Sağa / sola <output>{Math.round(photoTransform.x / POST_WIDTH * 100)}%</output></label><input id="photo-x" type="range" min={-POST_WIDTH} max={POST_WIDTH} value={photoTransform.x} disabled={busy} onChange={event => changePhoto({ x: Number(event.target.value) })} />
            <label htmlFor="photo-y">Yukarı / aşağı <output>{Math.round(photoTransform.y / POST_HEIGHT * 100)}%</output></label><input id="photo-y" type="range" min={-POST_HEIGHT} max={POST_HEIGHT} value={photoTransform.y} disabled={busy} onChange={event => changePhoto({ y: Number(event.target.value) })} />
            <div className={styles.photoButtons}><button type="button" disabled={busy} onClick={() => changePhoto(DEFAULT_PHOTO_TRANSFORM)}>Ortala</button></div>
          </div>}
        </div>
        <ExtraPhotoControls value={extraPhoto} disabled={busy || !background} onChange={value => { setExtraPhoto(value); setMessage(""); if (!value) setPhotoTarget("base"); }} onAdded={() => { setPhotoTarget("extra"); setDraggingEnabled(true); }} onError={setError} />
        {extraPhoto && <div className={styles.photoButtons} role="group" aria-label="Sürüklenecek fotoğraf">
          <button type="button" aria-pressed={photoTarget === "base"} onClick={() => setPhotoTarget("base")}>Ana fotoğrafı sürükle</button>
          <button type="button" aria-pressed={photoTarget === "extra"} onClick={() => setPhotoTarget("extra")}>Ek fotoğrafı sürükle</button>
        </div>}
      </section>
      </div>
      <section className={styles.controls} aria-label="Post düzenleme alanları">
        <div className={styles.field}><label id="post-description-label"><span>02</span>Haber açıklaması</label><PostTextEditor key={editorReset} value={description} onChange={value => { setDescription(value); setMessage(""); }} />{overflow && <p className={styles.warning} role="alert">Metin tasarıma sığmıyor. PNG indirmek için açıklamayı biraz kısalt.</p>}</div>
        <div className={`${styles.field} ${styles.compactField}`}><label htmlFor="post-location"><span>03</span>Konum</label><input id="post-location" type="text" value={location} maxLength={24} onChange={event => { setLocation(event.target.value); setMessage(""); }} placeholder="DÜNYA" /></div>
        <div className={`${styles.field} ${styles.compactField}`}><label><span>04</span>Tasarım detayları</label><div className={styles.options}>
          <button type="button" aria-pressed={decorations.quote} onClick={() => setDecorations(value => ({ ...value, quote: !value.quote }))}><span>Tırnak işareti</span><span aria-hidden="true">{decorations.quote ? "Açık" : "Kapalı"}</span></button>
          <button type="button" aria-pressed={decorations.swipe} onClick={() => setDecorations(value => ({ ...value, swipe: !value.swipe }))}><span>Fotoğrafı kaydır</span><span aria-hidden="true">{decorations.swipe ? "Açık" : "Kapalı"}</span></button>
        </div></div>
        {error && <div className={styles.error} role="alert">{error}{!background && <button type="button" onClick={() => setRetry(value => value + 1)} disabled={busy}>Tekrar dene</button>}</div>}
        {message && <p className={styles.success} role="status">{message}</p>}
        <div className={styles.actions}><button type="button" className={styles.download} disabled={busy || exporting || overflow || !background} onPointerDown={event => { if (event.pointerType === "touch") downloadTouchRef.current = { x: event.clientX, y: event.clientY }; }}
          onPointerCancel={() => { downloadTouchRef.current = null; }}
          onPointerUp={event => {
            const start = downloadTouchRef.current; downloadTouchRef.current = null;
            if (event.pointerType === "touch" && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12) {
              lastTouchDownloadRef.current = Date.now(); void download();
            }
          }}
          onClick={event => { if (event.detail === 0 || Date.now() - lastTouchDownloadRef.current > 800) void download(); }}><ArrowDownToLine size={16} aria-hidden="true" />{exporting ? "PNG hazırlanıyor…" : "PNG indir"}</button><button type="button" className={styles.reset} disabled={busy || !background} onClick={reset}><RotateCcw size={14} aria-hidden="true" />Sıfırla</button></div>
      </section>
    </div>
  </div>;
}
