"use client";

import { useState } from "react";
import type { ComparisonData } from "@/lib/currency-comparison";

export const COMPARISON_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];
export const chartPercent = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const shortDate = (date: string) => date.slice(5).split("-").reverse().join(".");

export default function CurrencyComparisonChart({ data }: { data: ComparisonData }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 460, height = 210, left = 12, right = 53, top = 15, bottom = 25;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const all = data.series.flatMap(series => series.values.filter((value): value is number => value !== null));
  const low = Math.min(0, ...all), high = Math.max(0, ...all);
  const pad = Math.max((high - low) * 0.12, 0.2), min = low - pad, max = high + pad;
  const first = Date.parse(data.dates[0]), last = Date.parse(data.dates[data.dates.length - 1]);
  const x = (index: number) => left + (Date.parse(data.dates[index]) - first) / (last - first || 1) * plotWidth;
  const y = (value: number) => top + (max - value) / (max - min) * plotHeight;
  const selected = Math.min(hover ?? data.dates.length - 1, data.dates.length - 1);
  const selectPoint = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const date = first + Math.max(0, Math.min(1, (clientX - rect.left - left / width * rect.width) / (plotWidth / width * rect.width))) * (last - first);
    let nearest = 0;
    for (let index = 1; index < data.dates.length; index++) if (Math.abs(Date.parse(data.dates[index]) - date) < Math.abs(Date.parse(data.dates[nearest]) - date)) nearest = index;
    setHover(nearest);
  };
  return <div className="comparison-visual">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0}
      aria-label={`${data.base} karşısında dönemsel yüzde değişim grafiği. Tarihler arasında sol ve sağ oklarla gezinin.`}
      onPointerMove={event => selectPoint(event.clientX, event.currentTarget)} onPointerDown={event => selectPoint(event.clientX, event.currentTarget)}
      onPointerLeave={() => setHover(null)} onFocus={() => setHover(index => index ?? data.dates.length - 1)} onBlur={() => setHover(null)}
      onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setHover(index => Math.max(0, Math.min(data.dates.length - 1, (index ?? data.dates.length - 1) + (event.key === "ArrowLeft" ? -1 : 1)))); } }}>
      <title>{data.series.map(series => `${series.code}/${data.base}`).join(", ")} · Başlangıç: %0</title>
      {Array.from({ length: 5 }, (_, index) => {
        const value = max - (max - min) * index / 4;
        return <g key={index}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#1e293b" strokeWidth="0.7" /><text x={width - right + 7} y={y(value) + 3} fill="#64748b" fontSize="10">{value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%</text></g>;
      })}
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="3 4" />
      {data.series.map((series, seriesIndex) => {
        let drawing = false;
        const path = series.values.map((value, index) => {
          if (value === null) { drawing = false; return ""; }
          const command = drawing ? "L" : "M"; drawing = true;
          return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
        }).join(" ");
        return <path key={series.code} d={path} fill="none" stroke={COMPARISON_COLORS[seriesIndex]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {hover !== null && <g><line x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} stroke="#64748b" strokeDasharray="2 3" />
        {data.series.map((series, index) => series.values[selected] !== null && <circle key={series.code} cx={x(selected)} cy={y(series.values[selected]!)} r="3" fill={COMPARISON_COLORS[index]} />)}
      </g>}
      {[0, Math.floor((data.dates.length - 1) / 2), data.dates.length - 1].map((index, tick) => <text key={tick} x={x(index)} y={height - 5} textAnchor={tick === 0 ? "start" : tick === 2 ? "end" : "middle"} fill="#64748b" fontSize="10">{shortDate(data.dates[index])}</text>)}
    </svg>
    <div className="comparison-readout" aria-live="polite"><span>{data.dates[selected].split("-").reverse().join(".")}</span><span>Başlangıç: %0</span></div>
    <div className="comparison-legend">{data.series.map((series, index) => <span key={series.code}><i style={{ backgroundColor: COMPARISON_COLORS[index] }} /><strong>{series.code}</strong><span>{series.values[selected] === null ? "—" : chartPercent(series.values[selected]!)}</span></span>)}</div>
  </div>;
}
