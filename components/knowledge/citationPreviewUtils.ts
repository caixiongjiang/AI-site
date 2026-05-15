/**
 * 引用预览：表格型 chunk 的 table_caption / table_body / table_footnote 分段，
 * 图片型的 image_* 分段与 Markdown 图片解析，
 * 以及 HTML 消毒（仅用于知识库内可信片段的展示）。
 */

export type TablePreviewParts = {
  caption: string;
  bodyHtml: string;
  footnote: string;
};

const TABLE_KEYS = [
  "table_caption",
  "table_body",
  "table_footnote",
] as const;

type TableKey = (typeof TABLE_KEYS)[number];

/**
 * 从 preview 文本解析三段式表格结构（顺序任意，按出现位置切片）。
 * 若无 `table_body:` 则返回 null，走普通文本预览。
 */
export function parseTablePreviewPreview(raw: string): TablePreviewParts | null {
  const s = (raw ?? "").trim();
  if (!s || !/table_body\s*:/i.test(s)) return null;

  const hits: { key: TableKey; start: number; headerLen: number }[] = [];
  for (const key of TABLE_KEYS) {
    const re = new RegExp(`${key}\\s*:`, "i");
    const m = s.match(re);
    if (m && m.index !== undefined) {
      hits.push({ key, start: m.index, headerLen: m[0].length });
    }
  }
  if (!hits.some((h) => h.key === "table_body")) return null;
  hits.sort((a, b) => a.start - b.start);

  const out: Record<TableKey, string> = {
    table_caption: "",
    table_body: "",
    table_footnote: "",
  };
  for (let i = 0; i < hits.length; i++) {
    const { key, start, headerLen } = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].start : s.length;
    out[key] = s.slice(start + headerLen, end).trim();
  }
  if (!out.table_body) return null;
  return {
    caption: out.table_caption,
    bodyHtml: out.table_body,
    footnote: out.table_footnote,
  };
}

/** 供 dangerouslySetInnerHTML：去掉脚本/高危标签与内联事件（知识库内容仍做底线防护） */
export function sanitizeCitationHtml(html: string): string {
  let t = html;
  t = t.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  t = t.replace(/<\/?(?:iframe|object|embed|base|link|style)\b[^>]*>/gi, "");
  t = t.replace(/\s(on[a-z]+\s*=|javascript\s*:)/gi, " data-blocked=");
  return t;
}

export function stripHtmlToPlain(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 超过该长度时，预览区使用固定高度 + 纵向滚动 */
export const CITATION_PREVIEW_SCROLL_LEN = 1000;

const IMAGE_KEYS = ["image_caption", "image_footnote", "image_body"] as const;
type ImageKey = (typeof IMAGE_KEYS)[number];

export type ImagePreviewParts = {
  caption: string;
  footnote: string;
  /** 预览里解析出的图片地址（http(s) 或站内绝对路径） */
  imageUrl: string | null;
};

function extractMarkdownImageUrl(s: string): string | null {
  const m = s.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  return m ? m[1].trim() : null;
}

function extractHttpOrPathUrl(s: string): string | null {
  const md = extractMarkdownImageUrl(s);
  if (md) return md;
  const m = s.match(/https?:\/\/[^\s<'"]+/i);
  if (m) return m[0];
  const rel = s.match(/(?:^|\s)(\/[\w\-./?#%&+=~]+)/);
  if (rel && /\.(?:png|jpe?g|gif|webp|svg)(?:\?|$)/i.test(rel[1]))
    return rel[1].trim();
  return null;
}

/**
 * 解析图片型 preview：`image_caption` / `image_footnote` / `image_body` 分段，
 * 或正文中的 `![alt](url)` / 裸露 http(s) 图片链接。
 */
export function parseImagePreviewPreview(raw: string): ImagePreviewParts | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  const keyed = /image_(caption|footnote|body)\s*:/i.test(s);
  let caption = "";
  let footnote = "";
  let body = "";

  if (keyed) {
    const hits: { key: ImageKey; start: number; headerLen: number }[] = [];
    for (const key of IMAGE_KEYS) {
      const re = new RegExp(`${key}\\s*:`, "i");
      const m = s.match(re);
      if (m && m.index !== undefined) {
        hits.push({ key, start: m.index, headerLen: m[0].length });
      }
    }
    hits.sort((a, b) => a.start - b.start);
    const out: Record<ImageKey, string> = {
      image_caption: "",
      image_footnote: "",
      image_body: "",
    };
    for (let i = 0; i < hits.length; i++) {
      const { key, start, headerLen } = hits[i];
      const end = i + 1 < hits.length ? hits[i + 1].start : s.length;
      out[key] = s.slice(start + headerLen, end).trim();
    }
    caption = out.image_caption;
    footnote = out.image_footnote;
    body = out.image_body;
  }

  const pooled = [caption, footnote, body, s].join("\n");
  const imageUrl = extractHttpOrPathUrl(pooled);

  if (keyed) {
    return { caption, footnote, imageUrl };
  }
  const onlyMd = extractMarkdownImageUrl(s);
  if (onlyMd) {
    return { caption: "", footnote: "", imageUrl: onlyMd };
  }
  return null;
}

/** 引用预览内 <img src>：仅允许 http(s) 与站内绝对路径 */
export function sanitizeCitationImageSrc(url: string): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  return null;
}
