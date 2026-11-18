"use client";

import { useEffect, useRef, useState } from "react";
import { Cropper, ImageRestriction, type CropperRef } from "react-advanced-cropper";
import { Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import "react-advanced-cropper/dist/style.css";
import { extraPhotoCrop, type ExtraPhoto } from "@/lib/post-designer";
import styles from "./PostDesigner.module.css";

type Props = { photo: ExtraPhoto; onApply: (photo: ExtraPhoto) => void; onClose: () => void };
const ratios = [{ label: "Serbest", value: undefined }, { label: "1:1", value: 1 }, { label: "4:3", value: 4 / 3 }, { label: "3:4", value: 3 / 4 }, { label: "16:9", value: 16 / 9 }];

export default function ExtraPhotoCropDialog({ photo, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cropper = useRef<CropperRef>(null);
  const [ratio, setRatio] = useState<number | undefined>();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [initial] = useState(() => extraPhotoCrop(photo));
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  const apply = () => {
    const crop = cropper.current?.getCoordinates();
    if (!crop || crop.width <= 0 || crop.height <= 0) return;
    const width = Math.min(photo.width, 1350 * crop.width / crop.height);
    onApply({ ...photo, width, height: width * crop.height / crop.width, sourceCrop: { x: crop.left, y: crop.top, width: crop.width, height: crop.height }, cropZoom: 1, cropX: 0, cropY: 0 });
  };
  return <dialog ref={dialog} className={styles.cropDialog} aria-labelledby="crop-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.cropDialogHeader}><div><h2 id="crop-dialog-title">Fotoğrafı kırp</h2><p>Çerçeveyi köşelerinden ayarla. Fotoğrafı sürükle veya iki parmakla yakınlaştır.</p></div><button type="button" aria-label="Kırpmayı kapat" onClick={onClose}><X size={18} /></button></div>
    <div className={styles.cropRatios} role="group" aria-label="Kırpma oranı">{ratios.map(option => <button key={option.label} type="button" aria-pressed={ratio === option.value} onClick={() => setRatio(option.value)}>{option.label}</button>)}</div>
    <div className={styles.cropStage}>
      <Cropper ref={cropper} src={photo.image.src} className={styles.interactiveCropper} imageRestriction={ImageRestriction.stencil} stencilProps={{ aspectRatio: ratio, grid: true }} defaultCoordinates={{ left: initial.x, top: initial.y, width: initial.width, height: initial.height }} onReady={() => setReady(true)} onError={() => setFailed(true)} />
      {!ready && <p className={styles.cropLoading} role="status">{failed ? "Fotoğraf açılamadı. Pencereyi kapatıp tekrar dene." : "Fotoğraf hazırlanıyor…"}</p>}
    </div>
    <div className={styles.cropZoomButtons} role="group" aria-label="Kırpma yakınlığı">
      <button type="button" aria-label="Uzaklaştır" disabled={!ready} onClick={() => cropper.current?.zoomImage(0.85)}><Minus size={17} /></button>
      <button type="button" aria-label="Yakınlaştır" disabled={!ready} onClick={() => cropper.current?.zoomImage(1.15)}><Plus size={17} /></button>
      <button type="button" disabled={!ready} onClick={() => { void cropper.current?.reset(); setRatio(undefined); }}><RotateCcw size={14} />Sıfırla</button>
    </div>
    <div className={styles.cropDialogFooter}><button type="button" className={styles.reset} onClick={onClose}>Vazgeç</button><button type="button" className={styles.download} disabled={!ready || failed} onClick={apply}><Check size={16} />Kırpmayı uygula</button></div>
  </dialog>;
}
