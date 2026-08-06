#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(ROOT, "packages/concierge/src");
const RESULT_PATH_FILES = new Set([
  "packages/concierge/src/concierge.ts",
  "packages/concierge/src/dispatch.ts",
  "packages/concierge/src/host.ts",
  "packages/concierge/src/message.ts",
]);
const FORBIDDEN_NAMES = new Set(["telemetry", "ontelemetry", "onerror"]);

function loadCompilerApi() {
  const rootRequire = createRequire(import.meta.url);
  const candidates = [];

  try {
    candidates.push(rootRequire("typescript"));
  } catch {
    // The diagnostic below reports an unavailable parser if no fallback works.
  }

  // TypeScript 7 exposes only its native-preview surface at the package root.
  // The locked ATTW toolchain also installs the stable compiler API, so resolve
  // that dependency through package metadata instead of a pnpm store pathname.
  try {
    const cliRequire = createRequire(
      rootRequire.resolve("@arethetypeswrong/cli/package.json"),
    );
    const coreRequire = createRequire(
      cliRequire.resolve("@arethetypeswrong/core/package.json"),
    );
    candidates.push(coreRequire("typescript"));
  } catch {
    // The capability check below owns the failure message.
  }

  const compiler = candidates.find(
    (candidate) =>
      typeof candidate?.createSourceFile === "function" &&
      typeof candidate?.forEachChild === "function" &&
      typeof candidate?.flattenDiagnosticMessageText === "function" &&
      typeof candidate?.SyntaxKind === "object" &&
      typeof candidate?.ScriptTarget === "object" &&
      typeof candidate?.ScriptKind === "object",
  );
  if (compiler === undefined) {
    throw new Error(
      "TypeScript compiler API unavailable: createSourceFile/forEachChild capability missing",
    );
  }
  return compiler;
}

function portablePath(path) {
  return relative(ROOT, path).split(sep).join("/");
}

function enumerateTypeScriptFiles(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `cannot read source directory ${portablePath(directory)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`ambiguous source entry is a symlink: ${portablePath(path)}`);
    }
    if (entry.isDirectory()) {
      files.push(...enumerateTypeScriptFiles(path));
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".ts")) files.push(path);
    } else {
      throw new Error(`unhandled source entry kind: ${portablePath(path)}`);
    }
  }
  return files;
}

function checkForbiddenName(text) {
  return FORBIDDEN_NAMES.has(text.replace(/^#/u, "").toLowerCase());
}

function main() {
  const ts = loadCompilerApi();
  const files = enumerateTypeScriptFiles(SOURCE_ROOT);
  if (files.length === 0) {
    throw new Error("source scan is empty");
  }

  const scannedPaths = new Set(files.map(portablePath));
  for (const required of RESULT_PATH_FILES) {
    if (!scannedPaths.has(required)) {
      throw new Error(`required dispatcher result-path file is absent: ${required}`);
    }
  }

  const findings = [];
  const findingKeys = new Set();

  for (const path of files) {
    const file = portablePath(path);
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      throw new Error(
        `cannot read source file ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    if (sourceFile?.kind !== ts.SyntaxKind.SourceFile) {
      throw new Error(`parser returned an invalid SourceFile for ${file}`);
    }
    if (!Array.isArray(sourceFile.parseDiagnostics)) {
      throw new Error(`parser did not expose parse diagnostics for ${file}`);
    }
    if (sourceFile.parseDiagnostics.length > 0) {
      for (const diagnostic of sourceFile.parseDiagnostics) {
        const start = diagnostic.start ?? 0;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
        findings.push({
          file,
          line: line + 1,
          character: character + 1,
          rule: "parse-diagnostic",
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        });
      }
      continue;
    }

    function position(node) {
      if (typeof node?.getStart !== "function") {
        throw new Error(`AST node has no getStart in ${file}`);
      }
      const start = node.getStart(sourceFile, false);
      if (!Number.isInteger(start) || start < 0 || start > text.length) {
        throw new Error(`AST node has an invalid start offset in ${file}`);
      }
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
      return { line: line + 1, character: character + 1 };
    }

    function addFinding(node, rule, message) {
      const at = position(node);
      const key = `${file}:${at.line}:${at.character}:${rule}:${message}`;
      if (findingKeys.has(key)) return;
      findingKeys.add(key);
      findings.push({ file, ...at, rule, message });
    }

    function inspectForbiddenText(node, value, context) {
      if (checkForbiddenName(value)) {
        addFinding(node, "forbidden-channel-name", `${context} '${value}' is prohibited`);
      }
    }

    function inspectNamedShape(node) {
      if (!("name" in node) || node.name === undefined) return;
      const name = node.name;
      if (
        ts.isIdentifier(name) ||
        ts.isPrivateIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name) ||
        ts.isNoSubstitutionTemplateLiteral(name) ||
        ts.isComputedPropertyName(name) ||
        ts.isObjectBindingPattern(name) ||
        ts.isArrayBindingPattern(name)
      ) {
        return;
      }
      addFinding(
        name,
        "ambiguous-name-shape",
        `unhandled declaration/property name kind ${String(ts.SyntaxKind[name.kind])}`,
      );
    }

    function inspectModuleSpecifier(node) {
      const specifier = node.moduleSpecifier;
      if (specifier === undefined) return;
      if (!ts.isStringLiteral(specifier)) {
        addFinding(
          specifier,
          "ambiguous-module-specifier",
          `unhandled module specifier kind ${String(ts.SyntaxKind[specifier.kind])}`,
        );
        return;
      }
      const segments = specifier.text
        .split("/")
        .map((segment) => segment.replace(/\.(?:[cm]?js|[cm]?ts)$/u, ""));
      for (const segment of segments) {
        inspectForbiddenText(specifier, segment, "import/export path segment");
      }
    }

    function staticCallTargetName(expression) {
      if (ts.isIdentifier(expression) || ts.isPrivateIdentifier(expression)) {
        return expression.text;
      }
      if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
      if (ts.isElementAccessExpression(expression)) {
        const argument = expression.argumentExpression;
        if (
          ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument) ||
          ts.isIdentifier(argument) ||
          ts.isPrivateIdentifier(argument)
        ) {
          return argument.text;
        }
        addFinding(
          argument,
          "ambiguous-call-target",
          `computed call target uses ${String(ts.SyntaxKind[argument.kind])}`,
        );
        return null;
      }
      if (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isNonNullExpression(expression) ||
        (typeof ts.isSatisfiesExpression === "function" &&
          ts.isSatisfiesExpression(expression))
      ) {
        return staticCallTargetName(expression.expression);
      }
      return null;
    }

    function collectBindingNames(name, names) {
      if (ts.isIdentifier(name)) {
        names.add(name.text);
        return;
      }
      if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const element of name.elements) {
          if (ts.isBindingElement(element)) collectBindingNames(element.name, names);
        }
        return;
      }
      addFinding(
        name,
        "ambiguous-catch-binding",
        `unhandled catch binding kind ${String(ts.SyntaxKind[name.kind])}`,
      );
    }

    function inspectCatchClause(node) {
      if (!RESULT_PATH_FILES.has(file) || node.variableDeclaration === undefined) {
        return;
      }
      addFinding(
        node.variableDeclaration,
        "catch-binding",
        "dispatcher result-path catches must not bind the thrown value",
      );
      const names = new Set();
      collectBindingNames(node.variableDeclaration.name, names);
      const visitUse = (candidate) => {
        if (ts.isIdentifier(candidate) && names.has(candidate.text)) {
          addFinding(
            candidate,
            "caught-value-forwarding",
            `caught value '${candidate.text}' is referenced and could reach a message, stack, string, return, result field, console, or callback`,
          );
        }
        ts.forEachChild(candidate, visitUse);
      };
      visitUse(node.block);
    }

    const visit = (node) => {
      if (typeof ts.SyntaxKind[node.kind] !== "string") {
        addFinding(node, "unknown-node-kind", `unhandled AST node kind ${String(node.kind)}`);
        return;
      }

      inspectNamedShape(node);
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
        inspectForbiddenText(node, node.text, "identifier");
      } else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        inspectForbiddenText(node, node.text, "string/computed name");
      }

      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        inspectModuleSpecifier(node);
      }
      if (ts.isCallExpression(node)) {
        const targetName = staticCallTargetName(node.expression);
        if (targetName !== null) {
          inspectForbiddenText(node.expression, targetName, "call target");
        }
        if (targetName?.toLowerCase() === "emit") {
          const event = node.arguments[0];
          if (event === undefined) {
            addFinding(node, "ambiguous-emission", "emit call has no statically auditable event name");
          } else if (
            ts.isStringLiteral(event) ||
            ts.isNoSubstitutionTemplateLiteral(event)
          ) {
            if (event.text.toLowerCase() === "telemetry") {
              addFinding(event, "telemetry-emission", "emit('telemetry', ...) is prohibited");
            }
          } else {
            addFinding(
              event,
              "ambiguous-emission",
              `emit event uses ${String(ts.SyntaxKind[event.kind])} instead of a static string`,
            );
          }
        }
      }
      if (ts.isCatchClause(node)) inspectCatchClause(node);

      ts.forEachChild(node, visit);
    };

    try {
      visit(sourceFile);
    } catch (error) {
      throw new Error(
        `AST traversal failed for ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.character - right.character ||
      left.rule.localeCompare(right.rule),
  );
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `${finding.file}:${finding.line}:${finding.character} [${finding.rule}] ${finding.message}`,
      );
    }
    console.error(`No-telemetry AST audit: ${files.length} files scanned, ${findings.length} finding(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`No-telemetry AST audit: ${files.length} files scanned, 0 findings`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
