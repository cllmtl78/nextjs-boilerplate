"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { loadPostImage, prepareUploadedPhoto, type ExtraPhoto } from "@/lib/post-designer";
import dynamic from "next/dynamic";
import styles from "./PostDesigner.module.css";

const ExtraPhotoCropDialog = dynamic(() => import("./ExtraPhotoCropDialog"), { ssr: false });

type Props = { value: ExtraPhoto | null; disabled: boolean; onChange: (value: ExtraPhoto | null) => void; onUpload: (photo: ExtraPhoto, append: boolean) => void; onError: (message: string) => void };

export default function ExtraPhotoControls({ value, disabled, onChange, onUpload, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const appendRef = useRef(false);
  const [cropping, setCropping] = useState(false);
  const [loading, setLoading] = useState(false);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setLoading(true); onError("");
    try {
      const prepared = await prepareUploadedPhoto(file);
      const image = await loadPostImage(prepared.data);
      onUpload({ image, x: 200, y: 350, width: 600, height: 400, radius: 0, cropZoom: 1, cropX: 0, cropY: 0 }, appendRef.current || !value);
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Ek fotoğraf açılamadı."); }
    finally { setLoading(false); }
  };
  const slider = (key: "radius", label: string, min: number, max: number, step = 1, suffix = "") => value && <div>
    <label htmlFor={`extra-${key}`}>{label}<output>{Math.round(value[key])}{suffix}</output></label>
    <input id={`extra-${key}`} type="range" min={min} max={max} step={step} value={value[key]} disabled={disabled || loading} onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} />
  </div>;
  return <div className={`${styles.field} ${styles.extraPhoto}`}>
    <label htmlFor="extra-photo-file">Ek fotoğraf</label>
    <input ref={fileRef} id="extra-photo-file" type="file" className={styles.file} tabIndex={-1} accept="image/jpeg,image/png,image/webp" disabled={disabled || loading} onChange={event => void upload(event)} />
    <button type="button" className={styles.upload} disabled={disabled || loading} onClick={() => { appendRef.current = false; fileRef.current?.click(); }}><ImagePlus size={18} aria-hidden="true" /><span>{loading ? "Fotoğraf hazırlanıyor…" : value ? "Ek fotoğrafı değiştir" : "Üste fotoğraf ekle"}</span></button>
    {value && <button type="button" className={styles.addExtraPhoto} disabled={disabled || loading} onClick={() => { appendRef.current = true; fileRef.current?.click(); }}><ImagePlus size={16} aria-hidden="true" />Yeni fotoğraf ekle</button>}
    {value && <>
      <div className={styles.photoControls}>
        <div>
          <label htmlFor="extra-scale">Yakınlık<output>{Math.round(value.width / 600 * 100)}%</output></label>
          <input id="extra-scale" type="range" min="10" max="250" value={Math.round(value.width / 600 * 100)} disabled={disabled || loading} onChange={event => {
            const width = 600 * Number(event.target.value) / 100;
            const height = value.height * width / value.width;
            onChange({ ...value, width, height, x: value.x + (value.width - width) / 2, y: value.y + (value.height - height) / 2 });
          }} />
        </div>
        {slider("radius", "Köşe yuvarlaklığı", 0, 100, 1, "%")}
        <div className={styles.photoButtons}>
          <button type="button" disabled={disabled || loading} onClick={() => setCropping(true)}><Crop size={15} aria-hidden="true" />Fotoğrafı kırp</button>
          <button type="button" disabled={disabled || loading} onClick={() => onChange(null)}><Trash2 size={13} aria-hidden="true" />Fotoğrafı kaldır</button>
        </div>
      </div>
      {cropping && <ExtraPhotoCropDialog photo={value} onApply={photo => { onChange(photo); setCropping(false); }} onClose={() => setCropping(false)} />}
    </>}
  </div>;
}
