"use client";

import { useEffect, useRef, useState } from "react";
import { readEditorRuns, type PostTextRun } from "@/lib/post-designer";
import styles from "./PostDesigner.module.css";

export default function PostTextEditor({ value, onChange }: { value: PostTextRun[]; onChange: (value: PostTextRun[]) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const preferredBold = useRef(true);
  const [format, setFormat] = useState<"bold" | "regular" | "mixed">("bold");
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || JSON.stringify(readEditorRuns(editor)) === JSON.stringify(value)) return;
    editor.replaceChildren(...value.map(run => {
      const node = document.createElement(run.bold ? "strong" : "span");
      node.textContent = run.text;
      return node;
    }));
    selectionRef.current = null;
  }, [value]);
  useEffect(() => {
    const save = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode) || !editorRef.current.contains(selection.focusNode)) return;
      selectionRef.current = selection.getRangeAt(0).cloneRange();
      setFormat(document.queryCommandIndeterm("bold") ? "mixed" : document.queryCommandState("bold") ? "bold" : "regular");
    };
    document.addEventListener("selectionchange", save);
    return () => document.removeEventListener("selectionchange", save);
  }, []);
  const publish = () => {
    if (!editorRef.current) return;
    const runs = readEditorRuns(editorRef.current);
    onChange(runs);
    if (!runs.some(run => run.text)) preferredBold.current = true;
  };
  const applyFormat = (bold: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    const range = selectionRef.current;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (range && editor.contains(range.commonAncestorContainer)) { selection?.removeAllRanges(); selection?.addRange(range); }
    if (selection && !selection.isCollapsed) document.execCommand("removeFormat");
    if (document.queryCommandState("bold") !== bold) document.execCommand("bold");
    preferredBold.current = bold; setFormat(bold ? "bold" : "regular"); publish();
  };
  return <div>
    <div className={styles.textToolbar} role="group" aria-label="Metin kalınlığı">
      <button type="button" aria-pressed={format === "bold"} onPointerDown={event => event.preventDefault()} onClick={() => applyFormat(true)}>Kalın</button>
      <button type="button" aria-pressed={format === "regular"} onPointerDown={event => event.preventDefault()} onClick={() => applyFormat(false)}>İnce</button>
      <span>Metni seç, kalınlığını değiştir.</span>
    </div>
    <div ref={editorRef} id="post-description" role="textbox" aria-labelledby="post-description-label" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={false} className={styles.richInput}
      onInput={publish}
      onFocus={() => { if (!editorRef.current?.textContent && document.queryCommandState("bold") !== preferredBold.current) document.execCommand("bold"); }}
      onBeforeInput={() => {
        const text = editorRef.current ? readEditorRuns(editorRef.current).map(run => run.text).join("") : "";
        const replacesAll = Boolean(text) && window.getSelection()?.toString() === text;
        const bold = replacesAll ? true : preferredBold.current;
        if ((!text || replacesAll) && document.queryCommandState("bold") !== bold) document.execCommand("bold");
      }}
      onPaste={event => {
        event.preventDefault();
        if (!document.queryCommandState("bold")) document.execCommand("bold");
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\r/g, ""));
        publish();
      }} />
  </div>;
}
