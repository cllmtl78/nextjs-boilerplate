"use client";

import { useId, useState } from "react";
import { macroDate, macroNumber, type MacroPoint } from "@/lib/macro-data";

type Props = { points: MacroPoint[]; color: string; title: string; unit: string; digits: number; compact?: boolean };
export default function MacroHistoryChart({ points, color, title, unit, digits, compact = false }: Props) {
  const gradient = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <div className="macro-chart-empty">Geçmiş veri bekleniyor</div>;
  const width = compact ? 300 : 700, height = compact ? 72 : 260;
  const left = compact ? 1 : 12, right = compact ? 1 : 76, top = compact ? 5 : 15, bottom = compact ? 2 : 28;
  const values = points.map(point => point.value);
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .13, Math.abs(high) * .002, .01);
  const min = low - padding, max = high + padding;
  const start = Date.parse(points[0].date), end = Date.parse(points[points.length - 1].date);
  const x = (index: number) => left + (Date.parse(points[index].date) - start) / (end - start || 1) * (width - left - right);
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const selected = Math.min(hover ?? points.length - 1, points.length - 1);
  const pointer = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const date = start + Math.max(0, Math.min(1, (clientX - rect.left - left / width * rect.width) / ((width - left - right) / width * rect.width))) * (end - start);
    let nearest = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(Date.parse(points[i].date) - date) < Math.abs(Date.parse(points[nearest].date) - date)) nearest = i;
    setHover(nearest);
  };
  return <div className={compact ? "macro-spark" : "macro-detail-chart"}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} geçmiş grafiği`} tabIndex={compact ? undefined : 0}
      onPointerMove={compact ? undefined : event => pointer(event.clientX, event.currentTarget)}
      onPointerDown={compact ? undefined : event => pointer(event.clientX, event.currentTarget)}
      onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
      onKeyDown={event => { if (!compact && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); setHover(index => Math.max(0, Math.min(points.length - 1, (index ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1)))); } }}>
      <title>{title} · {macroDate(points[0].date)} – {macroDate(points[points.length - 1].date)}</title>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {!compact && Array.from({ length: 4 }, (_, index) => {
        const value = max - (max - min) * index / 3;
        return <g key={index}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#1e293b" /><text x={width - right + 8} y={y(value) + 4} fill="#64748b" fontSize="11">{macroNumber(value, digits)}</text></g>;
      })}
      <path d={`${path} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`} fill={`url(#${gradient})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={compact ? 1.7 : 2} strokeLinecap="round" strokeLinejoin="round" />
      {points.length === 1 && <circle cx={x(0)} cy={y(points[0].value)} r="2" fill={color} />}
      {!compact && hover !== null && <g><line x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} stroke="#64748b" strokeDasharray="3 4" /><circle cx={x(selected)} cy={y(points[selected].value)} r="4" fill={color} /></g>}
      {!compact && [0, points.length - 1].map((index, tick) => <text key={tick} x={x(index)} y={height - 4} fill="#64748b" fontSize="11" textAnchor={tick ? "end" : "start"}>{macroDate(points[index].date)}</text>)}
    </svg>
    {!compact && <div className="macro-chart-readout" aria-live="polite"><span>{macroDate(points[selected].date)}</span><strong style={{ color }}>{macroNumber(points[selected].value, digits)} {unit}</strong></div>}
  </div>;
}
