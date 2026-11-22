import path from "node:path";

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "src/contracts may only import types, and only from other contract files.",
    },
    schema: [],
    messages: {
      notTypeOnly:
        'Contracts may only use `import type { ... } from "./..."` (ADR-0002). Make this a type-only import.',
      outsideContracts:
        "Contracts may only import from other files in src/contracts/ (ADR-0002); '{{source}}' is outside.",
      sideEffect:
        "Side-effect imports are not allowed in contracts (ADR-0002).",
      dynamic:
        "Dynamic import()/require() is not allowed in contracts (ADR-0002).",
    },
  },

  create(context) {
    const filename = context.filename;
    const norm = filename.split(path.sep).join("/");
    const idx = norm.lastIndexOf("/src/contracts/");
    if (idx === -1) return {};
    const contractsDir = norm.slice(0, idx + "/src/contracts".length);
    const fileDir = path.posix.dirname(norm);

    function insideContracts(source) {
      if (typeof source !== "string") return false;
      if (source === "@/contracts" || source.startsWith("@/contracts/")) {
        return true;
      }
      if (!source.startsWith("./") && !source.startsWith("../")) return false;
      const resolved = path.posix.normalize(path.posix.join(fileDir, source));
      return (
        resolved === contractsDir || resolved.startsWith(contractsDir + "/")
      );
    }

    function checkSource(node, sourceNode) {
      if (!insideContracts(sourceNode.value)) {
        context.report({
          node,
          messageId: "outsideContracts",
          data: { source: String(sourceNode.value) },
        });
        return false;
      }
      return true;
    }

    return {
      ImportDeclaration(node) {
        if (node.specifiers.length === 0) {
          context.report({ node, messageId: "sideEffect" });
          return;
        }
        if (!checkSource(node, node.source)) return;
        if (node.importKind !== "type") {
          context.report({ node, messageId: "notTypeOnly" });
        }
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSource(node, node.source);
      },
      TSImportType(node) {
        const lit =
          node.source ??
          (node.argument && node.argument.literal) ??
          node.argument;
        if (lit && typeof lit.value === "string") checkSource(node, lit);
      },
      ImportExpression(node) {
        context.report({ node, messageId: "dynamic" });
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          context.report({ node, messageId: "dynamic" });
        }
      },
    };
  },
};

export default rule;
