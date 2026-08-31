# Support policy

Concierge 0.3 is a supported public preview. “Supported” means its documented
surface has compatibility gates, security fixes, migration notes, and a defined
maintenance window. It does not imply a commercial SLA.

## Supported surface

The 0.3 support contract includes:

- documented exports from the public package export maps;
- runtime contract v3 and the documented signed-envelope v1 wire fields;
- public result, rejection, diagnostic, event, and reason discriminants;
- the peer and Node ranges in [COMPATIBILITY.md](./COMPATIBILITY.md);
- the behavior demonstrated by the maintained examples and integration guides.

For `0.3.x` patches, maintainers will not intentionally break those surfaces.
Bug or security fixes may reject input that was previously accepted when that
input violated a documented invariant or crossed a security boundary.

The following are not stable public surface:

- source files reached outside package export maps;
- internal helpers, cache identities, debug text, and undocumented diagnostics;
- the internal layout or styling of examples;
- APIs explicitly marked experimental;
- behavior of third-party model providers, frameworks, browsers, or registries.

## Maintenance window

Only the latest `0.3.x` patch receives general fixes. The 0.3 line is supported until
the later of:

- six months after `0.3.0` is published; or
- 90 days after `0.4.0` is published.

The 0.2 line remains eligible for critical security fixes until 90 days after
0.3.0 is published. Applications may remain on 0.2 during that window, but must
not combine its contract-v2 core with 0.3 adapters.

A contract bump, removal of AI SDK 6 or 7, removal of a documented export, or
increase in the Node floor requires a synchronized minor release, release
notes, and a migration guide. Deprecations remain available through the next
minor when retaining them is safe.

## Getting help

Use [GitHub Issues](https://github.com/fullselfbrowsing/Concierge/issues) for a
reproducible bug, compatibility report, or documentation problem. Include:

- exact Concierge, framework, AI SDK, Node, and package-manager versions;
- the smallest reproduction that preserves the problem;
- expected and observed structured outcomes;
- sanitized diagnostics with credentials and user data removed.

Support is best effort and has no response-time guarantee. Do not report a
vulnerability in a public issue; follow [SECURITY.md](./SECURITY.md).
