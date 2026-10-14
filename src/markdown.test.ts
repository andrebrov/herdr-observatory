import { describe, it, expect } from "vitest";
import { markdownDocument, type MarkdownNode } from "./markdown.js";
const elements = (
  doc: MarkdownNode[],
): Extract<MarkdownNode, { kind: "element" }>[] =>
  doc.flatMap((n) =>
    n.kind === "element" ? [n, ...elements(n.children)] : [],
  );
const plain = (doc: MarkdownNode[]): string =>
  doc.map((n) => (n.kind === "text" ? n.text : plain(n.children))).join("");
describe("safe Markdown document", () => {
  it("renders nested lists, emphasis, headings, quotes and inline code structurally", () => {
    const doc = markdownDocument(
      "# Title\n\nA **bold** and *emphasized* `claim`.\n\n> A quote\n\n3. First\n   - Nested\n4. Second\n\n---",
    );
    const nodes = elements(doc);
    expect(nodes.map((n) => n.tag)).toEqual(
      expect.arrayContaining([
        "h1",
        "p",
        "strong",
        "em",
        "code",
        "blockquote",
        "ol",
        "li",
        "ul",
        "hr",
      ]),
    );
    expect(nodes.find((n) => n.tag === "ol")?.start).toBe(3);
    expect(plain(doc)).toContain("Nested");
  });
  it("handles fenced code literally and keeps the language as metadata", () => {
    const doc = markdownDocument(
      '```typescript\nconst x = "<script>alert(1)</script>";\n```',
    );
    expect(elements(doc)[0]).toMatchObject({
      tag: "pre",
      language: "typescript",
    });
    expect(plain(doc)).toContain("<script>alert(1)</script>");
    expect(elements(doc).some((n) => String(n.tag) === "script")).toBe(false);
  });
  it("renders tables and validates alignment independently of arbitrary styles", () => {
    const doc = markdownDocument(
      "| Claim | Result |\n| :--- | ---: |\n| tests | **pass** |",
    );
    expect(elements(doc).map((n) => n.tag)).toEqual(
      expect.arrayContaining(["table", "thead", "tbody", "th", "td", "strong"]),
    );
    expect(
      elements(doc).find((n) => n.tag === "td" && n.align === "right"),
    ).toBeDefined();
  });
  it("supports noninteractive checked and unchecked task lists", () => {
    const doc = markdownDocument("- [x] Verified\n- [ ] Pending");
    expect(
      elements(doc)
        .filter((n) => n.tag === "li")
        .map((n) => n.checked),
    ).toEqual([true, false]);
    expect(plain(doc)).not.toContain("[x]");
  });
  it("keeps HTML, event handlers and malicious URLs inert", () => {
    const doc = markdownDocument(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n<iframe src="https://example.com"></iframe>',
    );
    expect(plain(doc)).toContain("<script>");
    expect(
      elements(doc).some((n) =>
        ["script", "img", "iframe", "a"].includes(n.tag),
      ),
    ).toBe(false);
    expect(elements(doc).some((n) => n.evidenceId)).toBe(false);
  });
  it("does not fetch images or create remote navigations", () => {
    const doc = markdownDocument(
      "![private image](https://example.com/pixel.png)\n\n[site](https://example.com)",
    );
    expect(plain(doc)).toContain("[Image: private image]");
    expect(
      elements(doc).find((n) => n.reference === "https://example.com"),
    ).toMatchObject({ tag: "span" });
    expect(elements(doc).some((n) => n.evidenceId)).toBe(false);
  });
  it("links only already-indexed evidence with an exact path match", () => {
    const evidence = [
      {
        id: "known",
        path: "/reports/test.txt",
        title: "test.txt",
        kind: "txt",
        integrity: "unbound" as const,
      },
    ];
    const doc = markdownDocument(
      "[Tests](test.txt) [Unknown](other.md) [Remote](https://example.com/test.txt) [Escaped](../secret.txt) [Invalid](%zz)",
      "/reports/report.md",
      evidence,
    );
    const links = elements(doc).filter((n) => n.reference !== undefined);
    expect(links.map((n) => n.evidenceId)).toEqual([
      "known",
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
  it("shows frontmatter as literal metadata without promoting fields to status", () => {
    const doc = markdownDocument(
      "---\nschema_version: 1\naccepted: true\n---\n\n# Ledger",
    );
    expect(elements(doc)[0]).toMatchObject({ tag: "pre", language: "yaml" });
    expect(plain(doc)).toContain("accepted: true");
    expect(elements(doc).filter((n) => n.tag === "h1")).toHaveLength(1);
    expect(elements(doc).filter((n) => n.tag === "h2")).toHaveLength(0);
  });
  it("bounds input size instead of silently truncating reports", () => {
    expect(() => markdownDocument("x".repeat(2 * 1024 * 1024 + 1))).toThrow(
      "2 MiB",
    );
  });
});
