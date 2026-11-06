export type KapContentBlock =
  | { type: "text"; text: string; heading?: boolean }
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
    return <p className="text-sm text-slate-300 leading-7 whitespace-pre-line font-normal break-words">{summary}</p>;
  }

  return (
    <div className="min-w-0 space-y-4 text-sm text-slate-300 leading-7 break-words">
      {content.map((block, index) =>
        block.type === "text" ? (
          block.heading ? <h3 key={index} className="pt-2 font-semibold text-slate-100">{block.text}</h3> : <p key={index} className="whitespace-pre-line">{block.text}</p>
        ) : (
          <div key={index} className="max-w-full overflow-x-auto rounded border border-slate-700" tabIndex={0} role="region" aria-label={block.caption || "Bildirim tablosu"}>
            <table className="w-full border-collapse text-left text-xs leading-5">
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
