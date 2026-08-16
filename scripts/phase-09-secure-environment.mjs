import { lstatSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import {
  delimiter as pathDelimiter,
  dirname,
  isAbsolute,
  join,
  normalize,
  resolve,
} from "node:path";

export const PHASE09_PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/";

const INHERITED_ENVIRONMENT_KEYS = Object.freeze([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
]);

const CHILD_OVERRIDE_KEYS = new Set([
  "NODE_OPTIONS",
  "PHASE09_ARCHIVE_EXPORT_DIR",
  "PHASE09_MUTATION_CAPTURE_DIR",
  "PHASE_08_SNAPSHOT_GATE",
  "PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN",
]);

const DIRECT_AMBIENT_ENVIRONMENT_KEYS = new Set([
  "actions_id_token_request_token",
  "actions_runtime_token",
  "all_proxy",
  "bash_env",
  "bitbucket_step_oidc_token",
  "buildkite_agent_access_token",
  "ci_job_jwt",
  "ci_job_token",
  "circle_token",
  "curl_ca_bundle",
  "curl_home",
  "env",
  "github_token",
  "gitlab_token",
  "http_proxy",
  "https_proxy",
  "ld_preload",
  "netrc",
  "node_auth_token",
  "node_extra_ca_certs",
  "node_options",
  "node_tls_reject_unauthorized",
  "no_proxy",
  "npm_auth_token",
  "npm_id_token",
  "npm_token",
  "requests_ca_bundle",
  "ssl_cert_dir",
  "ssl_cert_file",
  "system_accesstoken",
  "temp",
  "tmp",
  "tmpdir",
  "wgetrc",
]);

const HOME_AMBIENT_PATHS = Object.freeze([
  ".git-credentials",
  ".gitconfig",
  ".netrc",
  ".npmrc",
  ".pnpmrc",
  ".ssh",
  ".yarnrc",
  ".yarnrc.yml",
  "_netrc",
  ".config/gh",
  ".config/git/config",
  ".config/npm/npmrc",
  ".config/pnpm/rc",
]);

const XDG_AMBIENT_PATHS = Object.freeze([
  "gh",
  "git/config",
  "npm/npmrc",
  "pnpm/rc",
]);

const REPOSITORY_AMBIENT_PATHS = Object.freeze([
  ".netrc",
  ".npmrc",
  ".pnpmfile.cjs",
  ".pnpmrc",
  ".yarnrc",
  ".yarnrc.yml",
  "pnpmfile.cjs",
  "examples/adapter-ssr/.npmrc",
  "packages/concierge/.npmrc",
  "packages/concierge-react/.npmrc",
  "packages/concierge-svelte/.npmrc",
  "scripts/fixtures/phase-09-foreign-consumer/.npmrc",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function defaultPathPresent(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      ["ENOENT", "ENOTDIR"].includes(error.code)
    ) {
      return false;
    }
    throw error;
  }
}

function environmentEntries(environment) {
  assert(
    environment !== null &&
      typeof environment === "object" &&
      !Array.isArray(environment),
    "environment must be an object",
  );
  const seen = new Set();
  const entries = [];
  for (const [name, value] of Object.entries(environment)) {
    const normalized = name.toLowerCase();
    assert(
      !seen.has(normalized),
      `environment contains ambiguous case variants for ${name}`,
    );
    seen.add(normalized);
    if (value !== undefined) entries.push([name, String(value)]);
  }
  return entries;
}

function environmentValue(environment, expectedName) {
  const normalizedExpected = expectedName.toLowerCase();
  const matches = environmentEntries(environment).filter(
    ([name]) => name.toLowerCase() === normalizedExpected,
  );
  assert(
    matches.length <= 1,
    `environment contains ambiguous case variants for ${expectedName}`,
  );
  return matches[0]?.[1];
}

function isForbiddenAmbientEnvironmentName(name) {
  const normalized = name.toLowerCase();
  return (
    DIRECT_AMBIENT_ENVIRONMENT_KEYS.has(normalized) ||
    normalized.startsWith("gh_") ||
    normalized.startsWith("git_") ||
    normalized.startsWith("gcm_") ||
    normalized.startsWith("ssh_") ||
    normalized.startsWith("npm_") ||
    normalized.startsWith("pnpm_") ||
    normalized.startsWith("yarn_") ||
    normalized.startsWith("corepack_") ||
    /^(?:bitbucket|github|gitlab)_.+(?:auth|credential|key|oauth|pat|secret|token)/u.test(
      normalized,
    ) ||
    /^(?:dyld_.+|ld_library_path)$/u.test(normalized)
  );
}

function normalizedConfiguredDirectory(environment, name) {
  const value = environmentValue(environment, name);
  if (value === undefined || value === "") return null;
  assert(
    isAbsolute(value) && value === normalize(resolve(value)),
    `credential-free finalization rejected non-absolute ${name}`,
  );
  return value;
}

export function assertCredentialFreeFinalizationEnvironment(
  environment,
  { pathPresent = defaultPathPresent, repositoryRoot = null } = {},
) {
  for (const [name] of environmentEntries(environment)) {
    assert(
      !isForbiddenAmbientEnvironmentName(name),
      `credential-free finalization rejected ambient environment variable ${name}`,
    );
  }

  const candidates = new Map();
  const addPaths = (root, paths, source) => {
    if (root === null) return;
    for (const relativePath of paths) {
      candidates.set(join(root, relativePath), source);
    }
  };
  addPaths(
    normalizedConfiguredDirectory(environment, "HOME"),
    HOME_AMBIENT_PATHS,
    "HOME",
  );
  addPaths(
    normalizedConfiguredDirectory(environment, "USERPROFILE"),
    HOME_AMBIENT_PATHS,
    "USERPROFILE",
  );
  addPaths(
    normalizedConfiguredDirectory(environment, "XDG_CONFIG_HOME"),
    XDG_AMBIENT_PATHS,
    "XDG_CONFIG_HOME",
  );
  if (repositoryRoot !== null) {
    assert(
      isAbsolute(repositoryRoot) &&
        repositoryRoot === normalize(resolve(repositoryRoot)),
      "credential-free finalization repository root must be absolute and normalized",
    );
    addPaths(repositoryRoot, REPOSITORY_AMBIENT_PATHS, "repository");
  }

  for (const [path, source] of candidates) {
    assert(
      !pathPresent(path),
      `credential-free finalization rejected ambient ${source} credential/config path ${path}`,
    );
  }
  return true;
}

export function runAfterCredentialFreeFinalizationPreflight(
  environment,
  operation,
  options = {},
) {
  assertCredentialFreeFinalizationEnvironment(environment, options);
  return operation();
}

function makePrivateDirectory(path) {
  mkdirSync(path, { mode: 0o700 });
  assert(
    statSync(path).isDirectory(),
    `secure environment path is not a directory: ${path}`,
  );
}

function makeEmptyPrivateFile(path) {
  writeFileSync(path, "", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  assert(
    statSync(path).isFile() && statSync(path).size === 0,
    `secure environment config is not an empty regular file: ${path}`,
  );
}

export function createSecureChildEnvironment(
  ownedRoot,
  sourceEnvironment,
  { directoryName = "child-environment", executableDirectory = null } = {},
) {
  assert(
    isAbsolute(ownedRoot) && ownedRoot === normalize(resolve(ownedRoot)),
    "secure environment root must be absolute and normalized",
  );
  assert(
    statSync(ownedRoot).isDirectory(),
    "secure environment root must exist",
  );
  assert(
    /^[a-z0-9][a-z0-9-]*$/u.test(directoryName),
    "secure environment directory name is invalid",
  );

  const root = join(ownedRoot, directoryName);
  makePrivateDirectory(root);
  const paths = Object.freeze({
    gitConfig: join(root, "empty.gitconfig"),
    ghConfig: join(root, "gh"),
    gnupgHome: join(root, "gnupg"),
    home: join(root, "home"),
    npmCache: join(root, "npm-cache"),
    npmGlobalConfig: join(root, "empty-global.npmrc"),
    npmUserConfig: join(root, "empty-user.npmrc"),
    pnpmStore: join(root, "pnpm-store"),
    temporary: join(root, "tmp"),
    xdgCache: join(root, "xdg-cache"),
    xdgConfig: join(root, "xdg-config"),
    xdgData: join(root, "xdg-data"),
  });
  for (const path of [
    paths.ghConfig,
    paths.gnupgHome,
    paths.home,
    paths.npmCache,
    paths.pnpmStore,
    paths.temporary,
    paths.xdgCache,
    paths.xdgConfig,
    paths.xdgData,
  ]) {
    makePrivateDirectory(path);
  }
  for (const path of [
    paths.gitConfig,
    paths.npmGlobalConfig,
    paths.npmUserConfig,
  ]) {
    makeEmptyPrivateFile(path);
  }

  const environment = {};
  for (const name of INHERITED_ENVIRONMENT_KEYS) {
    const value = environmentValue(sourceEnvironment, name);
    if (value !== undefined && value !== "") environment[name] = value;
  }
  assert(
    typeof environment.PATH === "string" && environment.PATH.length > 0,
    "secure child environment requires PATH",
  );
  if (executableDirectory !== null) {
    assert(
      typeof executableDirectory === "string" &&
        isAbsolute(executableDirectory) &&
        executableDirectory === normalize(resolve(executableDirectory)) &&
        dirname(executableDirectory) === ownedRoot &&
        statSync(executableDirectory).isDirectory(),
      "secure child executable directory must be an existing direct child of the owned root",
    );
    environment.PATH =
      `${executableDirectory}${pathDelimiter}${environment.PATH}`;
  }
  Object.assign(environment, {
    CI: "1",
    FORCE_COLOR: "0",
    GCM_INTERACTIVE: "Never",
    GH_CONFIG_DIR: paths.ghConfig,
    GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_GLOBAL: paths.gitConfig,
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_KEY_1: "credential.interactive",
    GIT_CONFIG_KEY_2: "http.extraHeader",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_VALUE_0: "",
    GIT_CONFIG_VALUE_1: "never",
    GIT_CONFIG_VALUE_2: "",
    GIT_TERMINAL_PROMPT: "0",
    GNUPGHOME: paths.gnupgHome,
    HOME: paths.home,
    NO_COLOR: "1",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: paths.npmCache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBALCONFIG: paths.npmGlobalConfig,
    NPM_CONFIG_REGISTRY: PHASE09_PUBLIC_NPM_REGISTRY,
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: paths.npmUserConfig,
    PHASE09_CREDENTIAL_FREE_ENV: "1",
    PNPM_CONFIG_STORE_DIR: paths.pnpmStore,
    TEMP: paths.temporary,
    TMP: paths.temporary,
    TMPDIR: paths.temporary,
    USERPROFILE: paths.home,
    XDG_CACHE_HOME: paths.xdgCache,
    XDG_CONFIG_HOME: paths.xdgConfig,
    XDG_DATA_HOME: paths.xdgData,
  });
  return Object.freeze({
    environment: Object.freeze(environment),
    paths,
    root,
  });
}

export function mergeSecureChildEnvironment(environment, overrides = {}) {
  assert(
    environment?.PHASE09_CREDENTIAL_FREE_ENV === "1",
    "secure child environment is not initialized",
  );
  const merged = { ...environment };
  for (const [name, value] of environmentEntries(overrides)) {
    assert(
      CHILD_OVERRIDE_KEYS.has(name),
      `secure child environment rejected override ${name}`,
    );
    merged[name] = value;
  }
  return merged;
}
