import MarkdownIt, { type Token } from "markdown-it";
import { dirname, resolve } from "node:path";
import type { Evidence } from "./domain.js";
export const markdownTags = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
] as const;
export type MarkdownTag = (typeof markdownTags)[number];
export type MarkdownNode =
  | { kind: "text"; text: string }
  | {
      kind: "element";
      tag: MarkdownTag;
      children: MarkdownNode[];
      language?: string;
      start?: number;
      align?: "left" | "center" | "right";
      reference?: string;
      evidenceId?: string;
      checked?: boolean;
    };
const allowed = new Set<string>(markdownTags);
const parser = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  maxNesting: 20,
});
/** Parser tokens become a restricted tree, never an HTML string or arbitrary DOM attributes. */
export function markdownDocument(
  text: string,
  path = "",
  evidence: Evidence[] = [],
): MarkdownNode[] {
  if (Buffer.byteLength(text, "utf8") > 2 * 1024 * 1024)
    throw Error(
      "Markdown rendering limit is 2 MiB; open the local file for the full report.",
    );
  let count = 0;
  const convert = (tokens: Token[]): MarkdownNode[] => {
    const root: MarkdownNode[] = [],
      stack: MarkdownNode[][] = [root];
    for (const token of tokens) {
      if (++count > 100_000)
        throw Error("Markdown is too complex to preview; open the local file.");
      const current = stack.at(-1)!;
      if (token.nesting === -1) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      if (token.type === "inline") {
        current.push(...convert(token.children ?? []));
        continue;
      }
      if (
        token.type === "text" ||
        token.type === "html_inline" ||
        token.type === "html_block"
      ) {
        current.push({ kind: "text", text: token.content });
        continue;
      }
      if (token.type === "softbreak") {
        current.push({ kind: "text", text: "\n" });
        continue;
      }
      if (token.type === "image") {
        current.push({
          kind: "text",
          text: `[Image: ${token.content || "untitled"}] (${token.attrGet("src") ?? ""})`,
        });
        continue;
      }
      if (token.type === "fence" || token.type === "code_block") {
        const language = token.info.trim().split(/\s+/)[0];
        current.push({
          kind: "element",
          tag: "pre",
          children: [
            {
              kind: "element",
              tag: "code",
              children: [{ kind: "text", text: token.content }],
            },
          ],
          language: /^[\w+-]{1,32}$/.test(language) ? language : undefined,
        });
        continue;
      }
      if (token.type === "code_inline") {
        current.push({
          kind: "element",
          tag: "code",
          children: [{ kind: "text", text: token.content }],
        });
        continue;
      }
      const link = token.type === "link_open",
        tag = link ? "span" : token.tag;
      if (!allowed.has(tag)) {
        if (token.content) current.push({ kind: "text", text: token.content });
        if (token.nesting === 1) stack.push(current);
        continue;
      }
      const el: Extract<MarkdownNode, { kind: "element" }> = {
        kind: "element",
        tag: tag as MarkdownTag,
        children: [],
      };
      if (link) {
        const href = String(token.attrGet("href") ?? "");
        el.reference = href;
        // A link is actionable only when its exact lexical path is already indexed.
        // The existing readEvidence action revalidates canonical roots and file type.
        if (
          path &&
          !/^[a-z][a-z\d+.-]*:/i.test(href) &&
          !href.startsWith("//") &&
          !href.startsWith("#")
        ) {
          try {
            const target = resolve(dirname(path), decodeURIComponent(href));
            el.evidenceId = evidence.find((e) => e.path === target)?.id;
          } catch {
            /* Malformed URI remains an inert reference. */
          }
        }
      }
      const start = Number(token.attrGet("start"));
      if (
        tag === "ol" &&
        Number.isInteger(start) &&
        start > 0 &&
        start <= 1_000_000
      )
        el.start = start;
      const align = /^text-align:(left|center|right)$/.exec(
        String(token.attrGet("style") ?? ""),
      );
      if (align) el.align = align[1] as "left" | "center" | "right";
      current.push(el);
      if (token.nesting === 1) stack.push(el.children);
    }
    return root;
  };
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  const doc = convert(
    parser.parse(frontmatter ? text.slice(frontmatter[0].length) : text, {}),
  );
  if (frontmatter)
    doc.unshift({
      kind: "element",
      tag: "pre",
      language: "yaml",
      children: [
        {
          kind: "element",
          tag: "code",
          children: [{ kind: "text", text: frontmatter[1] }],
        },
      ],
    });
  const tasks = (nodes: MarkdownNode[]) => {
    for (const n of nodes) {
      if (n.kind !== "element") continue;
      if (n.tag === "li") {
        const p = n.children[0],
          first = p?.kind === "element" && p.tag === "p" ? p.children[0] : p;
        if (first?.kind === "text") {
          const m = /^\[([ xX])\]\s+/.exec(first.text);
          if (m) {
            n.checked = m[1] !== " ";
            first.text = first.text.slice(m[0].length);
          }
        }
      }
      tasks(n.children);
    }
  };
  tasks(doc);
  return doc;
}
