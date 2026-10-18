type Satir = { kaynak: string; baslik: string };

export default function FeedBox({
  baslik,
  satirlar,
  tur = "normal",
}: {
  baslik: string;
  satirlar: Satir[];
  tur?: "normal" | "tweet";
}) {
  return (
    <aside className={`feed ${tur === "tweet" ? "feed-resmi" : ""}`}>
      <div className="feed-baslik">
        <span>{baslik}</span>
        {tur === "tweet" && (
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="currentColor"
            style={{ opacity: 0.85 }}
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )}
      </div>
      <div className="feed-liste">
        {satirlar.map((s, i) => (
          <div key={i} className="feed-satir">
            <span className="feed-kaynak">
              {tur === "tweet" && (
                <svg
                  viewBox="0 0 24 24"
                  width="11"
                  height="11"
                  fill="#ef4444"
                  style={{
                    display: "inline-block",
                    marginRight: "4px",
                    verticalAlign: "-1px",
                  }}
                >
                  <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
                </svg>
              )}
              {s.kaynak}
            </span>
            <span className="feed-metin">{s.baslik}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}