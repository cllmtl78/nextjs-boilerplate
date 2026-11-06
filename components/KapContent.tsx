export type KapContentBlock =
  | { type: "text"; text: string }
  | {
      type: "table";
      caption?: string;
      rows: {
        text: string;
        header: boolean;
        colSpan: number;
        rowSpan: number;
      }[][];
    };

export default function KapContent({
  content,
  summary,
}: {
  content?: KapContentBlock[];
  summary: string;
}) {
  if (!content?.length) {
    return <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-normal">{summary}</p>;
  }

  return (
    <div className="min-w-0 space-y-3 text-xs text-slate-300 leading-relaxed">
      {content.map((block, index) =>
        block.type === "text" ? (
          <p key={index} className="whitespace-pre-line">{block.text}</p>
        ) : (
          <div key={index} className="max-w-full overflow-x-auto rounded border border-slate-700" tabIndex={0} role="region" aria-label={block.caption || "Bildirim tablosu"}>
            <table className="w-full border-collapse text-left">
              {block.caption && <caption className="p-2 text-left font-semibold text-slate-100">{block.caption}</caption>}
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-slate-800 last:border-0">
                    {row.map((cell, cellIndex) => {
                      const Cell = cell.header ? "th" : "td";
                      return (
                        <Cell key={cellIndex} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={`min-w-28 border-r border-slate-800 px-3 py-2 align-top whitespace-pre-line last:border-0 ${cell.header ? "bg-slate-800 font-semibold text-slate-100" : "tabular-nums"}`}>
                          {cell.text}
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
