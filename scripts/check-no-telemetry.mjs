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
const SELF_TEST_FILE = "packages/concierge/src/__no_telemetry_self_test__.ts";
const SELF_TEST_SOURCE = [
  'const prefix = "tele";',
  'const suffix = "metry";',
  "const concatenatedName = prefix + suffix;",
  "const templateName = `${prefix}${suffix}`;",
  "const aliasedName = concatenatedName;",
  "const sink = (): void => {};",
  "const channel = { [concatenatedName]: sink };",
  "channel[templateName] = sink;",
  "void channel[aliasedName];",
  "const { [aliasedName]: extracted } = channel;",
  "void extracted;",
  "declare const dynamicName: () => string;",
  "const runtimeName = dynamicName();",
  "const dynamicChannel = { [runtimeName]: sink };",
  "channel[runtimeName] = sink;",
  "void dynamicChannel;",
  "declare const operation: Promise<unknown>;",
  "declare const authoredResult: (...args: unknown[]) => unknown;",
  "declare const externalForwarder: (error: unknown) => unknown;",
  "operation.catch((error) => authoredResult(false, String(error)));",
  "operation.then(() => undefined, ({ message: alias }) => authoredResult(false, alias));",
  "function forwardError(error: unknown): unknown {",
  "  return authoredResult(false, error);",
  "}",
  "operation.catch(forwardError);",
  "operation.catch(externalForwarder);",
  "const observeSettlement = (): void => {};",
  "operation.then(observeSettlement, observeSettlement);",
].join("\n");

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

function main(selfTest = false) {
  const ts = loadCompilerApi();
  const files = selfTest ? [] : enumerateTypeScriptFiles(SOURCE_ROOT);
  const units = selfTest
    ? [{ file: SELF_TEST_FILE, text: SELF_TEST_SOURCE, resultPath: true }]
    : files.map((path) => ({
        file: portablePath(path),
        path,
        resultPath: RESULT_PATH_FILES.has(portablePath(path)),
      }));
  if (units.length === 0) {
    throw new Error("source scan is empty");
  }

  if (!selfTest) {
    const scannedPaths = new Set(files.map(portablePath));
    for (const required of RESULT_PATH_FILES) {
      if (!scannedPaths.has(required)) {
        throw new Error(`required dispatcher result-path file is absent: ${required}`);
      }
    }
  }

  const findings = [];
  const findingKeys = new Set();

  for (const unit of units) {
    const { file, resultPath } = unit;
    let text = unit.text;
    if (text === undefined) {
      try {
        text = readFileSync(unit.path, "utf8");
      } catch (error) {
        throw new Error(
          `cannot read source file ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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

    const constInitializers = new Map();
    const callbackDeclarations = new Map();

    function rememberDeclaration(map, name, value) {
      map.set(name, map.has(name) ? null : value);
    }

    const collectDeclarations = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined
      ) {
        const declarationList = node.parent;
        if ((declarationList.flags & ts.NodeFlags.Const) !== 0) {
          rememberDeclaration(constInitializers, node.name.text, node.initializer);
        }
        if (
          ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)
        ) {
          rememberDeclaration(
            callbackDeclarations,
            node.name.text,
            node.initializer,
          );
        }
      } else if (
        ts.isFunctionDeclaration(node) &&
        node.name !== undefined
      ) {
        rememberDeclaration(callbackDeclarations, node.name.text, node);
      }
      ts.forEachChild(node, collectDeclarations);
    };
    collectDeclarations(sourceFile);

    function unwrapExpression(expression) {
      if (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isNonNullExpression(expression) ||
        (typeof ts.isSatisfiesExpression === "function" &&
          ts.isSatisfiesExpression(expression))
      ) {
        return unwrapExpression(expression.expression);
      }
      return expression;
    }

    function resolveStaticProperty(expression, seen = new Set()) {
      const candidate = unwrapExpression(expression);
      if (
        ts.isStringLiteral(candidate) ||
        ts.isNoSubstitutionTemplateLiteral(candidate)
      ) {
        return { kind: "string", value: candidate.text };
      }
      if (ts.isNumericLiteral(candidate)) {
        return { kind: "number", value: candidate.text };
      }
      if (
        ts.isPrefixUnaryExpression(candidate) &&
        (candidate.operator === ts.SyntaxKind.PlusToken ||
          candidate.operator === ts.SyntaxKind.MinusToken) &&
        ts.isNumericLiteral(candidate.operand)
      ) {
        return {
          kind: "number",
          value: `${candidate.operator === ts.SyntaxKind.MinusToken ? "-" : ""}${candidate.operand.text}`,
        };
      }
      if (
        ts.isBinaryExpression(candidate) &&
        candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const left = resolveStaticProperty(candidate.left, new Set(seen));
        const right = resolveStaticProperty(candidate.right, new Set(seen));
        if (left?.kind === "string" && right?.kind === "string") {
          return { kind: "string", value: `${left.value}${right.value}` };
        }
        return null;
      }
      if (ts.isTemplateExpression(candidate)) {
        let value = candidate.head.text;
        for (const span of candidate.templateSpans) {
          const resolved = resolveStaticProperty(span.expression, new Set(seen));
          if (resolved === null) return null;
          value += `${resolved.value}${span.literal.text}`;
        }
        return { kind: "string", value };
      }
      if (ts.isIdentifier(candidate)) {
        if (seen.has(candidate.text)) return null;
        const initializer = constInitializers.get(candidate.text);
        if (initializer === undefined || initializer === null) return null;
        const nextSeen = new Set(seen);
        nextSeen.add(candidate.text);
        return resolveStaticProperty(initializer, nextSeen);
      }
      return null;
    }

    function inspectComputedExpression(node, context, ambiguousRule) {
      const resolved = resolveStaticProperty(node);
      if (resolved?.kind === "string") {
        inspectForbiddenText(node, resolved.value, context);
        return;
      }
      if (resolved?.kind === "number") return;
      addFinding(
        node,
        ambiguousRule,
        `${context} must resolve to a static string or numeric literal`,
      );
    }

    function inspectComputedElement(node) {
      const argument = node.argumentExpression;
      const resolved = resolveStaticProperty(argument);
      if (resolved?.kind === "string") {
        inspectForbiddenText(argument, resolved.value, "computed element access");
        return;
      }
      if (resolved?.kind === "number") return;

      const parent = node.parent;
      if (
        ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const assigned = unwrapExpression(parent.right);
        const assignedCallback = ts.isIdentifier(assigned)
          ? callbackDeclarations.get(assigned.text)
          : assigned;
        if (
          assignedCallback !== undefined &&
          assignedCallback !== null &&
          (ts.isArrowFunction(assignedCallback) ||
            ts.isFunctionExpression(assignedCallback) ||
            ts.isFunctionDeclaration(assignedCallback))
        ) {
          addFinding(
            argument,
            "ambiguous-computed-access",
            "dynamic computed assignment of a callable channel is prohibited",
          );
        }
      }
    }

    function inspectNamedShape(node) {
      if (!("name" in node) || node.name === undefined) return;
      const name = node.name;
      if (ts.isComputedPropertyName(name)) {
        if (
          node.kind !== ts.SyntaxKind.PropertySignature &&
          node.kind !== ts.SyntaxKind.MethodSignature
        ) {
          inspectComputedExpression(
            name.expression,
            "computed declaration/property name",
            "ambiguous-computed-name",
          );
        }
        return;
      }
      if (
        ts.isIdentifier(name) ||
        ts.isPrivateIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name) ||
        ts.isNoSubstitutionTemplateLiteral(name) ||
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
        const resolved = resolveStaticProperty(argument);
        if (resolved !== null) {
          return resolved.value;
        }
        addFinding(
          argument,
          "ambiguous-call-target",
          "computed call target must resolve to a static property name",
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
        "ambiguous-exception-binding",
        `unhandled exception binding kind ${String(ts.SyntaxKind[name.kind])}`,
      );
    }

    function inspectCatchClause(node) {
      if (!resultPath || node.variableDeclaration === undefined) {
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

    function resolveRejectionCallback(expression) {
      const candidate = unwrapExpression(expression);
      if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
        return candidate;
      }
      if (ts.isIdentifier(candidate)) {
        const declaration = callbackDeclarations.get(candidate.text);
        return declaration === null ? null : (declaration ?? null);
      }
      return null;
    }

    function inspectRejectionCallback(callback, context) {
      if (!resultPath) return;
      const resolved = resolveRejectionCallback(callback);
      if (resolved === null) {
        addFinding(
          callback,
          "ambiguous-rejection-callback",
          `${context} must use a locally auditable function with no rejection parameter`,
        );
        return;
      }
      if (resolved.parameters.length === 0) return;

      const names = new Set();
      for (const parameter of resolved.parameters) {
        addFinding(
          parameter,
          "rejection-binding",
          `${context} must not bind the rejected value`,
        );
        collectBindingNames(parameter.name, names);
      }
      const visitUse = (candidate) => {
        if (ts.isIdentifier(candidate) && names.has(candidate.text)) {
          addFinding(
            candidate,
            "caught-value-forwarding",
            `rejected value '${candidate.text}' is referenced and could reach a message, stack, string, return, result field, console, or callback`,
          );
        }
        ts.forEachChild(candidate, visitUse);
      };
      if (resolved.body !== undefined) visitUse(resolved.body);
    }

    const visit = (node) => {
      if (typeof ts.SyntaxKind[node.kind] !== "string") {
        addFinding(node, "unknown-node-kind", `unhandled AST node kind ${String(node.kind)}`);
        return;
      }

      inspectNamedShape(node);
      if (
        ts.isComputedPropertyName(node) &&
        node.parent.kind !== ts.SyntaxKind.PropertySignature &&
        node.parent.kind !== ts.SyntaxKind.MethodSignature
      ) {
        inspectComputedExpression(
          node.expression,
          "computed declaration/property name",
          "ambiguous-computed-name",
        );
      }
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
        inspectForbiddenText(node, node.text, "identifier");
      } else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        inspectForbiddenText(node, node.text, "string/computed name");
      }
      if (ts.isElementAccessExpression(node)) {
        inspectComputedElement(node);
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
        if (targetName?.toLowerCase() === "catch") {
          const rejection = node.arguments[0];
          if (rejection !== undefined) {
            inspectRejectionCallback(rejection, "Promise.catch rejection callback");
          }
        }
        if (targetName?.toLowerCase() === "then") {
          const rejection = node.arguments[1];
          if (rejection !== undefined) {
            inspectRejectionCallback(
              rejection,
              "Promise.then rejection callback",
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
  if (selfTest) {
    const expectedMinimums = new Map([
      ["forbidden-channel-name", 4],
      ["ambiguous-computed-name", 1],
      ["ambiguous-computed-access", 1],
      ["rejection-binding", 3],
      ["caught-value-forwarding", 3],
      ["ambiguous-rejection-callback", 1],
    ]);
    for (const [rule, minimum] of expectedMinimums) {
      const count = findings.filter((finding) => finding.rule === rule).length;
      if (count < minimum) {
        throw new Error(
          `self-test expected at least ${minimum} '${rule}' findings, observed ${count}`,
        );
      }
    }
    for (const fragment of [
      "{ [concatenatedName]",
      "channel[templateName] =",
      "channel[aliasedName]",
      "{ [aliasedName]: extracted }",
    ]) {
      const line = SELF_TEST_SOURCE.split("\n").findIndex((sourceLine) =>
        sourceLine.includes(fragment),
      ) + 1;
      if (
        line === 0 ||
        !findings.some(
          (finding) =>
            finding.line === line && finding.rule === "forbidden-channel-name",
        )
      ) {
        throw new Error(
          `self-test did not reject computed forbidden-name fixture '${fragment}'`,
        );
      }
    }
    const observeLine = SELF_TEST_SOURCE.split("\n").findIndex((line) =>
      line.includes("operation.then(observeSettlement"),
    ) + 1;
    if (
      findings.some(
        (finding) =>
          finding.line === observeLine &&
          (finding.rule === "rejection-binding" ||
            finding.rule === "ambiguous-rejection-callback"),
      )
    ) {
      throw new Error(
        "self-test rejected a locally resolved zero-parameter rejection callback",
      );
    }
    console.log(
      `No-telemetry AST audit self-test: ${findings.length} malicious finding(s) detected across computed names and rejection callbacks`,
    );
    return;
  }
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `${finding.file}:${finding.line}:${finding.character} [${finding.rule}] ${finding.message}`,
      );
    }
    console.error(`No-telemetry AST audit: ${units.length} files scanned, ${findings.length} finding(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`No-telemetry AST audit: ${units.length} files scanned, 0 findings`);
}

try {
  const [argument] = process.argv.slice(2);
  if (argument !== undefined && argument !== "--self-test") {
    throw new Error("Usage: node scripts/check-no-telemetry.mjs [--self-test]");
  }
  main(argument === "--self-test");
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
