import {
  CallExpression,
  ScriptTarget,
  SyntaxKind,
  Project,
  Node,
  ts,
} from "ts-morph";
import { parse } from "@vue/compiler-sfc";
import { getNodeByKind } from "./helpers/node";
import { hasNamedImportIdentifier } from "./helpers/module";
import { convertImportDeclaration } from "./converter/importDeclarationConverter";
import { convertPageMeta } from "./converter/pageMetaConverter";
import { convertProps } from "./converter/propsConverter";
import { convertSetup } from "./converter/setupConverter";
import { convertEmits } from "./converter/emitsConverter";
import { convertComponents } from "./converter/componentsConverter";
import { convertDefineOptions } from "./converter/defineOptionsConverter";
import { genImport } from "knitwork";

export const isAlreadyScriptSetup = (input: string): boolean => {
  const { descriptor } = parse(input);
  return !!descriptor.scriptSetup;
};

export const hasScript = (input: string): boolean => {
  const { descriptor } = parse(input);
  return !!descriptor.script;
};

export const convertSrc = (input: string) => {
  if (isAlreadyScriptSetup(input)) {
    return input;
  }

  if (!hasScript(input)) {
    return input;
  }

  const {
    descriptor: { script },
  } = parse(input);

  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.Latest,
    },
    useInMemoryFileSystem: true,
  });

  const sourceFile = project.createSourceFile("s.tsx", script?.content ?? "");
  const lang = script?.lang ?? "js";

  const callexpression = getNodeByKind(sourceFile, SyntaxKind.CallExpression);

  if (!callexpression) {
    throw new Error("defineComponent is not found.");
  }
  if (!Node.isCallExpression(callexpression)) {
    throw new Error("defineComponent is not found.");
  }

  if (!isDefineComponent(callexpression)) {
    throw new Error("defineComponent is not found.");
  }

  const importMap = convertImportDeclaration(sourceFile) ?? "";
  const pageMeta = convertPageMeta(callexpression, lang) ?? "";
  const propsResult = convertProps(callexpression, lang);
  const props = propsResult.code ?? "";
  const emits = convertEmits(callexpression, lang) ?? "";
  const statement = convertSetup(callexpression, propsResult.propNames) ?? "";
  const components = convertComponents(callexpression) ?? "";
  const defineOptions = convertDefineOptions(callexpression) ?? "";

  const hasDynamicImport = components.includes("defineAsyncComponent");
  const hasUseAttrs = statement.includes("useAttrs()");
  const hasUseSlots = statement.includes("useSlots()");

  const statements = project.createSourceFile("new.tsx");

  // Add necessary imports
  if (importMap.length > 0) {
    if (
      hasDynamicImport &&
      !importMap[0].importSpecifiers.includes("defineAsyncComponent")
    ) {
      importMap[0].importSpecifiers.push("defineAsyncComponent");
    }

    if (hasUseAttrs && !importMap[0].importSpecifiers.includes("useAttrs")) {
      importMap[0].importSpecifiers.push("useAttrs");
    }

    if (hasUseSlots && !importMap[0].importSpecifiers.includes("useSlots")) {
      importMap[0].importSpecifiers.push("useSlots");
    }
  }

  // Only add import statements if there are valid import specifiers
  const validImports = importMap.filter((x) => x.importSpecifiers.length > 0);
  if (validImports.length > 0) {
    statements.addStatements(
      validImports.map((x) => genImport(x.moduleSpecifier, x.importSpecifiers))
    );
  }

  statements.addStatements(
    sourceFile
      .getStatements()
      .filter((state) => {
        if (Node.isExportAssignment(state)) return false;
        if (Node.isImportDeclaration(state)) {
          const moduleSpecifier = state.getModuleSpecifierValue();
          // Imports from vue and #imports are already processed by convertImportDeclaration, so exclude them
          // However, preserve type-only imports
          if (
            ["vue", "#imports"].includes(moduleSpecifier) &&
            !state.isTypeOnly()
          )
            return false;
          if (
            hasNamedImportIdentifier(state, "defineComponent") ||
            hasNamedImportIdentifier(state, "defineNuxtComponent")
          )
            return false;
        }

        return true;
      })
      .map((x) => {
        return x.getText();
      })
  );

  statements.addStatements(components);

  if (defineOptions) {
    statements.addStatements(defineOptions);
  }

  if (isDefineNuxtComponent(callexpression)) {
    statements.addStatements(pageMeta);
  }

  statements.addStatements(props);
  statements.addStatements(emits);
  statements.addStatements(statement);

  statements.formatText({
    semicolons: ts.SemicolonPreference.Insert,
    indentSize: 2,
  });

  const scriptSetupTag =
    lang === "ts" ? '<script setup lang="ts">' : "<script setup>";

  // Get full text and ensure proper line breaks between statements
  let convertedCode = statements.getFullText().trim();

  // Fix the specific issue where type Props and const are on the same line
  convertedCode = convertedCode.replace(/};\s*const\s+/g, "};\nconst ");

  // Handle empty component case - ensure at least one newline for minimal valid script setup
  if (convertedCode === "") {
    return `${scriptSetupTag}\n</script>`;
  }

  return `${scriptSetupTag}\n${convertedCode}\n</script>`;
};

const isDefineComponent = (node: CallExpression) => {
  if (!Node.isIdentifier(node.getExpression())) {
    return false;
  }

  return (
    node.getExpression().getText() === "defineComponent" ||
    node.getExpression().getText() === "defineNuxtComponent"
  );
};

const isDefineNuxtComponent = (node: CallExpression) => {
  if (!Node.isIdentifier(node.getExpression())) {
    return false;
  }
  return node.getExpression().getText() === "defineNuxtComponent";
};
