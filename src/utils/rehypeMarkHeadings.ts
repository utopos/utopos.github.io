type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

/**
 * Wraps the content of article h2 headings in the title-marker span,
 * so they get the same always-on highlighter as the article title.
 */
export function rehypeMarkHeadings() {
  return (tree: Node) => {
    const walk = (node: Node) => {
      if (node.type === "element" && node.tagName === "h2") {
        node.children = [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["title-marker"], dataMarked: "" },
            children: node.children ?? [],
          },
        ];
        return;
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
