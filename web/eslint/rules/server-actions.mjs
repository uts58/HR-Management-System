const DEFAULT_ALLOWED_SOURCES = ["@/server/action"];
const PUBLIC_ROLE = "PUBLIC";
const PUBLIC_ALLOWED_SEGMENT = "/src/auth/";

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
      configNotInline:
        "defineAction must be called with a single inline object literal (no variables or spreads) so its role can be checked (ADR-0002).",
      missingRole: "defineAction config must declare `role` (ADR-0002).",
      roleNotStatic:
        "`role` must be a string literal, a member expression like Role.HR_ADMIN, or an array of those, so lint can verify it (ADR-0002).",
      publicOutsideAuth:
        '`role: "PUBLIC"` (no session required) is only allowed in src/auth/** (ADR-0002/0004).',
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

    const filename = context.filename.replaceAll("\\", "/");
    const publicAllowed = filename.includes(PUBLIC_ALLOWED_SEGMENT);

    function readRoles(node) {
      if (node.type === "Literal" && typeof node.value === "string") {
        return [node.value];
      }
      if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
        return [node.quasis[0].value.cooked];
      }
      if (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.property.type === "Identifier"
      ) {
        return [node.property.name];
      }
      if (
        node.type === "TSAsExpression" ||
        node.type === "TSSatisfiesExpression"
      ) {
        return readRoles(node.expression);
      }
      if (node.type === "ArrayExpression") {
        const out = [];
        for (const el of node.elements) {
          if (!el || el.type === "SpreadElement") return null;
          const r = readRoles(el);
          if (!r) return null;
          out.push(...r);
        }
        return out;
      }
      return null;
    }

    function checkDefineActionCall(call) {
      const arg = call.arguments[0];
      if (
        call.arguments.length !== 1 ||
        arg.type !== "ObjectExpression" ||
        arg.properties.some((p) => p.type !== "Property")
      ) {
        context.report({ node: call, messageId: "configNotInline" });
        return;
      }
      const roleProp = arg.properties.find(
        (p) =>
          !p.computed &&
          ((p.key.type === "Identifier" && p.key.name === "role") ||
            (p.key.type === "Literal" && p.key.value === "role")),
      );
      if (!roleProp) {
        context.report({ node: arg, messageId: "missingRole" });
        return;
      }
      const roles = roleProp.shorthand ? null : readRoles(roleProp.value);
      if (!roles) {
        context.report({ node: roleProp, messageId: "roleNotStatic" });
        return;
      }
      if (roles.includes(PUBLIC_ROLE) && !publicAllowed) {
        context.report({ node: roleProp, messageId: "publicOutsideAuth" });
      }
    }

    const visitors = {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "defineAction"
        ) {
          checkDefineActionCall(node);
        }
      },
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
