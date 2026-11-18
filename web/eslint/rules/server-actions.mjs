/**
 * Local ESLint rule: hr/server-actions-use-define-action
 *
 * Enforces ADR-0002 "Server action auth is enforced structurally":
 *
 *  1. In a file whose first directive is 'use server', every runtime export
 *     must look like
 *         export const name = defineAction({ role, schema, handler });
 *     `defineAction` must be imported (by that name, unaliased) from one of
 *     the allowed modules. Any other export form is an error: function
 *     declarations, `let`/`var`, re-exports, `export { x }`, default
 *     exports, `export *`, or wrapped calls (`defineAction(...) as X`).
 *     Type-only exports are allowed because they are erased at compile time.
 *
 *  2. Inline 'use server' directives inside function bodies are rejected in
 *     every file. Server actions must live in a 'use server' module.
 *
 * defineAction runs requireRole, then schema validation, then the handler,
 * so this rule guarantees that every server action is authorised and
 * validated.
 */

const DEFAULT_ALLOWED_SOURCES = ["@/lib/action", "@/server/action"];

/** @param {import("estree").Node[]} body */
function hasUseServerDirective(body) {
  for (const stmt of body) {
    if (
      stmt.type !== "ExpressionStatement" ||
      typeof stmt.directive !== "string"
    ) {
      return false;
    }
    if (stmt.directive === "use server") return true;
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every export of a 'use server' file to be `export const x = defineAction(...)` and forbid inline 'use server' functions.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedSources: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      notDefineAction:
        "Exports of a 'use server' file must be `export const {{name}} = defineAction({ role, schema, handler })` (ADR-0002).",
      forbiddenExportForm:
        "This export form is not allowed in a 'use server' file. Use `export const x = defineAction({ role, schema, handler })` (ADR-0002).",
      defineActionNotImported:
        "`defineAction` must be imported from one of: {{sources}}.",
      inlineUseServer:
        "Inline 'use server' functions are not allowed. Put the action in a 'use server' actions.ts file and wrap it in defineAction (ADR-0002).",
    },
  },

  create(context) {
    const allowedSources =
      context.options[0]?.allowedSources ?? DEFAULT_ALLOWED_SOURCES;
    const sourceCode = context.sourceCode;
    const program = sourceCode.ast;
    const isUseServerFile = hasUseServerDirective(program.body);

    /** Is the `defineAction` identifier bound to an allowed import? */
    function isImportedDefineAction(identifierNode) {
      const scope = sourceCode.getScope(identifierNode);
      let ref = null;
      for (let s = scope; s && !ref; s = s.upper) {
        ref = s.set.get(identifierNode.name) ?? null;
      }
      const def = ref?.defs[0];
      if (!def || def.type !== "ImportBinding") return false;
      if (def.node.type !== "ImportSpecifier") return false;
      const imported = def.node.imported;
      const importedName =
        imported.type === "Identifier" ? imported.name : imported.value;
      if (importedName !== "defineAction") return false;
      return allowedSources.includes(def.parent.source.value);
    }

    function checkFunctionBody(node) {
      if (node.body && node.body.type === "BlockStatement") {
        if (hasUseServerDirective(node.body.body)) {
          context.report({ node, messageId: "inlineUseServer" });
        }
      }
    }

    const visitors = {
      FunctionDeclaration: checkFunctionBody,
      FunctionExpression: checkFunctionBody,
      ArrowFunctionExpression: checkFunctionBody,
    };

    if (!isUseServerFile) return visitors;

    return {
      ...visitors,

      ExportNamedDeclaration(node) {
        if (node.exportKind === "type") return;
        const decl = node.declaration;

        if (!decl) {
          // `export { a }` / `export { a } from "./b"`: can't be verified.
          // Allow only if every specifier is type-only.
          const allTypes =
            node.specifiers.length > 0 &&
            node.specifiers.every((s) => s.exportKind === "type");
          if (!allTypes)
            context.report({ node, messageId: "forbiddenExportForm" });
          return;
        }

        if (
          decl.type === "TSTypeAliasDeclaration" ||
          decl.type === "TSInterfaceDeclaration" ||
          (decl.type === "TSModuleDeclaration" && decl.declare) ||
          decl.declare === true
        ) {
          return;
        }

        if (decl.type !== "VariableDeclaration" || decl.kind !== "const") {
          context.report({ node, messageId: "forbiddenExportForm" });
          return;
        }

        for (const d of decl.declarations) {
          const name = d.id.type === "Identifier" ? d.id.name : "action";
          const init = d.init;
          const ok =
            d.id.type === "Identifier" &&
            init?.type === "CallExpression" &&
            init.callee.type === "Identifier" &&
            init.callee.name === "defineAction";
          if (!ok) {
            context.report({
              node: d,
              messageId: "notDefineAction",
              data: { name },
            });
            continue;
          }
          if (!isImportedDefineAction(init.callee)) {
            context.report({
              node: init.callee,
              messageId: "defineActionNotImported",
              data: { sources: allowedSources.join(", ") },
            });
          }
        }
      },

      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "forbiddenExportForm" });
      },

      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        context.report({ node, messageId: "forbiddenExportForm" });
      },
    };
  },
};

export default rule;
