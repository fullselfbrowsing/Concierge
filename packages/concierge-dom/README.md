<div align="center">

<img src="https://raw.githubusercontent.com/fullselfbrowsing/Concierge/main/assets/concierge-wordmark-horizontal.svg" alt="Concierge" width="280">

# `@full-self-browsing/concierge-dom`

</div>

Framework-neutral visible-element helpers for
[`@full-self-browsing/concierge`](https://github.com/fullselfbrowsing/Concierge).

The package never searches the document. It only returns an element the
application registered under a key it already owns. There is no selector,
predicate, XPath, or coordinate in any public signature, and the built
artifact is gated against host-DOM query and actuation primitives.

Requires Node 22.12 or newer. Peers on `@full-self-browsing/concierge` at
contract v4.

## Install

```sh
pnpm add @full-self-browsing/concierge-dom @full-self-browsing/concierge
```

## Register, then resolve

Construct the registry at module scope — construction touches no global, so
it is safe for a server to evaluate. Registration itself must not run during
server rendering; ref callbacks and Svelte `use:` actions already satisfy
that, the same way `createBridge` does.

```ts
import { createAnchorRegistry } from "@full-self-browsing/concierge-dom";

export const anchors = createAnchorRegistry({ id: "pipeline" });
```

```tsx
<article ref={anchors.ref(deal.id)}>{deal.label}</article>
<section ref={anchors.ref(`${deal.id}:notes`, { readable: true })}>
  {deal.notes}
</section>
```

```svelte
<li use:anchors.action(`line:${line.id}`}>{line.label}</li>
```

`ref(key)` returns the same callback identity on every call, so it is safe
in JSX without memoisation. Options supplied on a later call replace the
options used for subsequent registrations. A key holds a *set* of
registrations: two simultaneously mounted nodes for one record is the
responsive case this package exists to solve.

Do not place an `AnchorRegistry` on a bridge snapshot. It is a capability
object, not a value; `captureSnapshot` would report it as exotic.

## Resolve, reveal, read

`resolve` is a pure query. It measures each live registration, keeps the
ones that satisfy `isRendered`, and returns the first survivor. Pass
`within` as an element you already registered (an open dialog, a sheet) to
prefer a survivor that element contains. There is no fallback to a hidden
candidate.

```ts
const found = anchors.resolve(dealId, {
  within: anchors.resolve("detail-panel").element,
});

if (found.status !== "rendered") {
  return { ok: false, reason: "not_found", message: appCopy(found.status) };
}

await anchors.reveal(dealId, {
  within: found.element,
  defer: "frame",
  block: "center",
  markMs: 1200,
});
```

`reveal` is the only routine that mutates the page: scroll position, and
optionally the reserved `data-concierge-reveal` attribute so the application
can style `[data-concierge-reveal]`. A second reveal for the same key
cancels that key's pending frame and pending mark. An aborted signal
cancels without scrolling. `.focus()` is banned; the application may focus
the returned element itself.

`readUntrusted` extracts bounded visible text from a subtree registered
with `{ readable: true }`. Readability is a declaration, not a markup
accident — an anchored billing panel is not thereby agent-readable. The
walk uses the live tree (a detached clone has no computed style) and skips
`script`, `style`, `noscript`, `template`, `svg`, `iframe`, and `object` by
`tagName`. The result is untrusted. An action that returns it must declare
`readsUntrusted: true`. `ReadOutcome` is not a consent artifact.

Every operation returns a status, never a sentence. The application owns
narration.

## Visibility

`measureVisibility` walks `parentElement` and reports attributes, computed
style, `aria-busy`, layout, and depth. Two named policies sit on that
report and are not merged:

- `isRendered` — connected, no hiding attribute, no hiding style. Ignores
  `busy` and `hasLayout`.
- `isReadable` — `isRendered` and not `aria-busy`.

`hasLayout` is `getClientRects().length > 0`. It is always `false` under
jsdom and is consulted by neither policy.

## Viewport

`scrollViewport`, `readViewportPosition`, and `preferredScrollBehavior` are
the exports with no registry gate: they reach no element and read nothing
back. They throw if invoked where `window` / `document` do not exist. On a
page with scroll-triggered loading, scrolling causes the application to
fetch.

## Contract guard

The first registration of a registry's life calls `assertSingleInstance()`
and checks `CONTRACT_VERSION` against `EXPECTED_CORE_CONTRACT_VERSION`
(4). A mismatched core throws before any registration is stored. The guard
is not at module scope.

## License

MIT © Full Self Browsing
