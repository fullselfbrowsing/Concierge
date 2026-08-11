#!/usr/bin/env node

const USAGE =
  "Usage: node scripts/phase-09-mutation-battery.mjs " +
  "self-test|preflight <registered-id>|run all --jobs <1-4>|" +
  "verify <evidence|release|all>";

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

function parseInvocation(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "self-test") {
    return Object.freeze({ kind: "self-test" });
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "preflight" &&
    /^M-09-(?:R1|R2|S1|SSR1|B1|P1|C1)$/u.test(arguments_[1] ?? "")
  ) {
    return Object.freeze({ kind: "preflight", id: arguments_[1] });
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === "run" &&
    arguments_[1] === "all" &&
    arguments_[2] === "--jobs"
  ) {
    const jobs = Number(arguments_[3]);
    if (Number.isInteger(jobs) && jobs >= 1 && jobs <= 4) {
      return Object.freeze({ kind: "run-all", jobs });
    }
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "verify" &&
    ["evidence", "release", "all"].includes(arguments_[1])
  ) {
    return Object.freeze({ kind: `verify-${arguments_[1]}` });
  }
  throw new UsageError();
}

async function main(arguments_) {
  const invocation = parseInvocation(arguments_);
  throw new Error(
    `[RED:09-12-02:MUTATION_RUNNER_UNIMPLEMENTED] ${invocation.kind}`,
  );
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 64;
  } else {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
