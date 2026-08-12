#!/usr/bin/env node

import { readdirSync } from "node:fs";
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
  "declare const channels: Record<string, { send: (input: unknown) => void }>;",
  "declare const secret: unknown;",
  "channels[runtimeName].send(secret);",
  "void channel[runtimeName];",
  "channel[runtimeName]({});",
  "channel[runtimeName] ||= sink;",
  "channel[runtimeName] = externalForwarder;",
  "Object.defineProperty(channel, runtimeName, { value: externalForwarder });",
  "const value = externalForwarder;",
  "Object.defineProperty(channel, runtimeName, { value });",
  "Reflect.defineProperty(channel, runtimeName, { value: externalForwarder });",
  "Reflect.set(channel, runtimeName, externalForwarder);",
  "declare const dataKey: string;",
  "const dataRows: Record<string, { value: number }> = {};",
  "dataRows[dataKey] = { value: 1 };",
  "void dataRows[dataKey];",
  "operation.catch((error) => authoredResult(false, String(error)));",
  "operation.then(() => undefined, ({ message: alias }) => authoredResult(false, alias));",
  "function forwardError(error: unknown): unknown {",
  "  return authoredResult(false, error);",
  "}",
  "operation.catch(forwardError);",
  "operation.catch(externalForwarder);",
  "const observeSettlement = (): void => {};",
  "operation.then(observeSettlement, observeSettlement);",
  "operation.catch(function () { return authoredResult(false, String(arguments[0])); });",
  "operation.then(() => undefined, function rejected() { return authoredResult(false, String(arguments[0])); });",
  "function forwardArguments(): unknown {",
  "  return authoredResult(false, String(arguments[0]));",
  "}",
  "operation.catch(forwardArguments);",
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
      typeof candidate?.createCompilerHost === "function" &&
      typeof candidate?.createProgram === "function" &&
      typeof candidate?.forEachChild === "function" &&
      typeof candidate?.flattenDiagnosticMessageText === "function" &&
      typeof candidate?.SyntaxKind === "object" &&
      typeof candidate?.ScriptTarget === "object" &&
      typeof candidate?.ScriptKind === "object" &&
      typeof candidate?.SignatureKind === "object" &&
      typeof candidate?.TypeFlags === "object",
  );
  if (compiler === undefined) {
    throw new Error(
      "TypeScript compiler API unavailable: parser/program/checker capability missing",
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
  const selfTestPath = join(ROOT, SELF_TEST_FILE);
  const units = selfTest
    ? [{ file: SELF_TEST_FILE, path: selfTestPath, resultPath: true }]
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

  const compilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  };
  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  const defaultFileExists = compilerHost.fileExists.bind(compilerHost);
  const defaultReadFile = compilerHost.readFile.bind(compilerHost);
  const defaultGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  compilerHost.fileExists = (path) =>
    resolve(path) === selfTestPath || defaultFileExists(path);
  compilerHost.readFile = (path) =>
    resolve(path) === selfTestPath ? SELF_TEST_SOURCE : defaultReadFile(path);
  compilerHost.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
    resolve(path) === selfTestPath
      ? ts.createSourceFile(
          path,
          SELF_TEST_SOURCE,
          languageVersion,
          true,
          ts.ScriptKind.TS,
        )
      : defaultGetSourceFile(
          path,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        );
  const program = ts.createProgram({
    rootNames: units.map((unit) => unit.path),
    options: compilerOptions,
    host: compilerHost,
  });
  const checker = program.getTypeChecker();

  const findings = [];
  const findingKeys = new Set();

  for (const unit of units) {
    const { file, resultPath } = unit;
    const sourceFile = program.getSourceFile(unit.path);
    if (sourceFile?.kind !== ts.SyntaxKind.SourceFile) {
      throw new Error(`parser returned an invalid SourceFile for ${file}`);
    }
    const text = sourceFile.text;
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
    const objectKeySources = new Map();

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

    function staticMemberCall(expression, objectName, memberName) {
      const candidate = unwrapExpression(expression);
      if (ts.isPropertyAccessExpression(candidate)) {
        const base = unwrapExpression(candidate.expression);
        return (
          ts.isIdentifier(base) &&
          base.text === objectName &&
          candidate.name.text === memberName
        );
      }
      if (ts.isElementAccessExpression(candidate)) {
        const base = unwrapExpression(candidate.expression);
        const member = resolveStaticProperty(candidate.argumentExpression);
        return (
          ts.isIdentifier(base) &&
          base.text === objectName &&
          member?.kind === "string" &&
          member.value === memberName
        );
      }
      return false;
    }

    function objectKeysSource(expression) {
      const candidate = unwrapExpression(expression);
      if (
        ts.isCallExpression(candidate) &&
        staticMemberCall(candidate.expression, "Object", "keys")
      ) {
        return candidate.arguments[0] ?? null;
      }
      if (ts.isIdentifier(candidate)) {
        return objectKeySources.get(candidate.text) ?? null;
      }
      return null;
    }

    const collectObjectKeySources = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined
      ) {
        const source = objectKeysSource(node.initializer);
        if (source !== null) {
          rememberDeclaration(objectKeySources, node.name.text, source);
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        const source = objectKeysSource(node.right);
        if (source !== null) {
          rememberDeclaration(objectKeySources, node.left.text, source);
        }
      }
      ts.forEachChild(node, collectObjectKeySources);
    };
    collectObjectKeySources(sourceFile);

    function typeParts(type) {
      return type.isUnionOrIntersection?.() ? type.types : [type];
    }

    function typeMayBeCallable(type) {
      return typeParts(type).some((part) => {
        if (
          (part.flags &
            (ts.TypeFlags.Any |
              ts.TypeFlags.Unknown |
              ts.TypeFlags.TypeParameter)) !==
          0
        ) {
          return true;
        }
        return (
          checker.getSignaturesOfType(part, ts.SignatureKind.Call).length > 0
        );
      });
    }

    function typeIsKnownCallable(type) {
      return typeParts(type).some((part) => {
        if ((part.flags & ts.TypeFlags.Any) !== 0) return true;
        return (
          checker.getSignaturesOfType(part, ts.SignatureKind.Call).length > 0
        );
      });
    }

    function typeIsKnownInertData(type, seen = new Set(), depth = 0) {
      if (depth > 12) return false;
      return typeParts(type).every((part) => {
        if (
          (part.flags &
            (ts.TypeFlags.Any |
              ts.TypeFlags.Unknown |
              ts.TypeFlags.TypeParameter)) !==
          0
        ) {
          return false;
        }
        if (
          (part.flags &
            (ts.TypeFlags.StringLike |
              ts.TypeFlags.NumberLike |
              ts.TypeFlags.BooleanLike |
              ts.TypeFlags.BigIntLike |
              ts.TypeFlags.ESSymbolLike |
              ts.TypeFlags.Null |
              ts.TypeFlags.Undefined |
              ts.TypeFlags.Never)) !==
          0
        ) {
          return true;
        }
        if (checker.getSignaturesOfType(part, ts.SignatureKind.Call).length > 0) {
          return false;
        }
        if (seen.has(part)) return true;
        const nextSeen = new Set(seen);
        nextSeen.add(part);
        return checker.getPropertiesOfType(part).every((property) => {
          const location =
            property.valueDeclaration ?? property.declarations?.[0] ?? sourceFile;
          return typeIsKnownInertData(
            checker.getTypeOfSymbolAtLocation(property, location),
            nextSeen,
            depth + 1,
          );
        });
      });
    }

    function keyCannotNameAStringChannel(argument) {
      const type = checker.getTypeAtLocation(argument);
      return typeParts(type).every(
        (part) =>
          (part.flags &
            (ts.TypeFlags.Number |
              ts.TypeFlags.NumberLiteral |
              ts.TypeFlags.ESSymbol |
              ts.TypeFlags.UniqueESSymbol)) !==
          0,
      );
    }

    function enumeratedObjectForKey(argument) {
      if (!ts.isIdentifier(argument)) return null;
      let current = argument.parent;
      while (current !== undefined) {
        if (ts.isForOfStatement(current)) {
          const declaration = current.initializer.declarations?.[0];
          if (
            declaration !== undefined &&
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === argument.text
          ) {
            return objectKeysSource(current.expression);
          }
          return null;
        }
        current = current.parent;
      }
      return null;
    }

    function sameDataObject(left, right) {
      return (
        unwrapExpression(left).getText(sourceFile) ===
        unwrapExpression(right).getText(sourceFile)
      );
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
      if (keyCannotNameAStringChannel(argument)) return;

      const parent = node.parent;
      if (
        ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        if (
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          !typeMayBeCallable(checker.getTypeAtLocation(parent.right))
        ) {
          return;
        }
        addFinding(
          argument,
          "ambiguous-computed-access",
          "dynamic computed assignment can install or update a callable channel",
        );
        return;
      }

      if (
        (ts.isPrefixUnaryExpression(parent) ||
          ts.isPostfixUnaryExpression(parent)) &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken ||
          parent.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        addFinding(
          argument,
          "ambiguous-computed-access",
          "dynamic computed update can read and replace a channel",
        );
        return;
      }

      const enumeratedObject = enumeratedObjectForKey(argument);
      if (
        enumeratedObject !== null &&
        sameDataObject(node.expression, enumeratedObject)
      ) {
        return;
      }

      const usedAsPropertyReceiver =
        ((ts.isPropertyAccessExpression(parent) ||
          ts.isElementAccessExpression(parent)) &&
          parent.expression === node);
      if (
        usedAsPropertyReceiver &&
        !typeIsKnownInertData(checker.getTypeAtLocation(node))
      ) {
        addFinding(
          argument,
          "ambiguous-computed-access",
          "dynamic computed receiver can select an object carrying a callable channel",
        );
        return;
      }

      if (typeMayBeCallable(checker.getTypeAtLocation(node))) {
        addFinding(
          argument,
          "ambiguous-computed-access",
          "dynamic computed read can resolve to a callable channel",
        );
      }
    }

    function objectLiteralMember(object, name) {
      const candidate = unwrapExpression(object);
      if (!ts.isObjectLiteralExpression(candidate)) return null;
      for (const property of candidate.properties) {
        if (
          ts.isShorthandPropertyAssignment(property) &&
          property.name.text === name
        ) {
          return property.name;
        }
        if (
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === name) ||
            (ts.isStringLiteral(property.name) && property.name.text === name))
        ) {
          return property.initializer;
        }
        if (
          (ts.isMethodDeclaration(property) ||
            ts.isGetAccessorDeclaration(property) ||
            ts.isSetAccessorDeclaration(property)) &&
          ((ts.isIdentifier(property.name) && property.name.text === name) ||
            (ts.isStringLiteral(property.name) && property.name.text === name))
        ) {
          return property;
        }
      }
      return null;
    }

    function inspectDynamicChannelInstaller(node) {
      let key = null;
      let installedValues = [];
      if (
        staticMemberCall(node.expression, "Object", "defineProperty") ||
        staticMemberCall(node.expression, "Reflect", "defineProperty")
      ) {
        key = node.arguments[1] ?? null;
        const descriptor = node.arguments[2];
        if (descriptor === undefined) return;
        installedValues = [
          objectLiteralMember(descriptor, "value"),
          objectLiteralMember(descriptor, "get"),
          objectLiteralMember(descriptor, "set"),
        ].filter((value) => value !== null);
        if (installedValues.length === 0 && !ts.isObjectLiteralExpression(unwrapExpression(descriptor))) {
          installedValues = [descriptor];
        }
      } else if (staticMemberCall(node.expression, "Reflect", "set")) {
        key = node.arguments[1] ?? null;
        const value = node.arguments[2];
        if (value !== undefined) installedValues = [value];
      } else {
        return;
      }

      if (key === null || resolveStaticProperty(key) !== null) return;
      if (
        installedValues.some((value) =>
          typeIsKnownCallable(checker.getTypeAtLocation(value)),
        )
      ) {
        addFinding(
          key,
          "ambiguous-computed-access",
          "dynamic property installation of a callable channel is prohibited",
        );
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
      if (resolved.parameters.length === 0) {
        if (ts.isArrowFunction(resolved)) return;

        const visitArguments = (candidate) => {
          if (
            candidate !== resolved &&
            (ts.isFunctionExpression(candidate) ||
              ts.isFunctionDeclaration(candidate) ||
              ts.isMethodDeclaration(candidate))
          ) {
            return;
          }
          if (ts.isIdentifier(candidate) && candidate.text === "arguments") {
            addFinding(
              candidate,
              "rejection-arguments",
              `${context} must not read the callback-local arguments object`,
            );
          }
          ts.forEachChild(candidate, visitArguments);
        };
        if (resolved.body !== undefined) visitArguments(resolved.body);
        return;
      }

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
        inspectDynamicChannelInstaller(node);
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
      ["ambiguous-computed-access", 6],
      ["ambiguous-call-target", 1],
      ["rejection-binding", 3],
      ["caught-value-forwarding", 3],
      ["ambiguous-rejection-callback", 1],
      ["rejection-arguments", 3],
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
    for (const [fragment, rule] of [
      ["void channel[runtimeName]", "ambiguous-computed-access"],
      ["channel[runtimeName]({})", "ambiguous-call-target"],
      ["channel[runtimeName] ||=", "ambiguous-computed-access"],
      ["channel[runtimeName] = externalForwarder", "ambiguous-computed-access"],
      ["Object.defineProperty(channel, runtimeName, { value: externalForwarder", "ambiguous-computed-access"],
      ["channels[runtimeName].send(secret)", "ambiguous-computed-access"],
      ["Object.defineProperty(channel, runtimeName, { value })", "ambiguous-computed-access"],
      ["Reflect.defineProperty(channel, runtimeName", "ambiguous-computed-access"],
      ["Reflect.set(channel, runtimeName", "ambiguous-computed-access"],
    ]) {
      const line = SELF_TEST_SOURCE.split("\n").findIndex((sourceLine) =>
        sourceLine.includes(fragment),
      ) + 1;
      if (
        line === 0 ||
        !findings.some(
          (finding) => finding.line === line && finding.rule === rule,
        )
      ) {
        throw new Error(
          `self-test did not reject dynamic channel fixture '${fragment}' as '${rule}'`,
        );
      }
    }
    for (const fragment of [
      "dataRows[dataKey] =",
      "void dataRows[dataKey]",
    ]) {
      const line = SELF_TEST_SOURCE.split("\n").findIndex((sourceLine) =>
        sourceLine.includes(fragment),
      ) + 1;
      if (
        findings.some(
          (finding) =>
            finding.line === line &&
            (finding.rule === "ambiguous-computed-access" ||
              finding.rule === "ambiguous-call-target"),
        )
      ) {
        throw new Error(
          `self-test rejected checker-classified indexed data fixture '${fragment}'`,
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
            finding.rule === "rejection-arguments" ||
            finding.rule === "ambiguous-rejection-callback"),
      )
    ) {
      throw new Error(
        "self-test rejected a locally resolved zero-parameter rejection callback",
      );
    }
    for (const fragment of [
      "operation.catch(function ()",
      "function rejected()",
      "  return authoredResult(false, String(arguments[0]))",
    ]) {
      const line = SELF_TEST_SOURCE.split("\n").findIndex((sourceLine) =>
        sourceLine.includes(fragment),
      ) + 1;
      if (
        line === 0 ||
        !findings.some(
          (finding) =>
            finding.line === line && finding.rule === "rejection-arguments",
        )
      ) {
        throw new Error(
          `self-test did not reject callback-local arguments fixture '${fragment}'`,
        );
      }
    }
    console.log(
      `No-telemetry AST audit self-test: ${findings.length} malicious finding(s) detected across computed names, channel access, and rejection callbacks`,
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
