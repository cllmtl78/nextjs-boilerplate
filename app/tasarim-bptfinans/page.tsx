import type { Metadata } from "next";
import PostDesigner from "@/components/PostDesigner";

export const metadata: Metadata = {
  title: "Post Tasarımı | BPT Finans",
  description: "BPT Finans post şablonunu düzenle ve 1080 × 1350 PNG olarak indir.",
  robots: { index: false, follow: false },
};

export default function PostDesignPage() { return <PostDesigner />; }
