# Bridge registration

`createBridge` still returns a single-slot registry. The object is now an
`ObservableBridgeRegistry`: `id`, `read`, and `register` keep their existing
meanings, and two new members expose the arrival edge.

`BridgeRegistry` itself is unchanged. Hand-built wrappers that only implement
`id`/`read`/`register` keep compiling. They lose `subscribe` and `drain`, and
`awaitRegistration` then refuses them at compile time.

## Ordering

1. `register(bridge)` commits the slot, then emits `"registered"`. Inside a
   listener, `read()` already returns that bridge.
2. An accepted unregister clears the slot, then emits `"unregistered"`.
3. A refused unregister (React StrictMode, HMR, remount) emits nothing.
4. An overwrite emits one `"registered"` for the new bridge and no
   `"unregistered"` for the displaced one.
5. `drain()` emits `"drained"` and changes nothing else. Call it from the
   surface's own unmount so pending waiters can fail closed instead of hanging.

Fan-out is synchronous. That is deliberate: a microtask would let a second
`register()` land before the first event, which would break waiters.

## Wait for a lazy surface

```ts
const wait = await awaitRegistration(registry, {
  timeoutMs: 2_000,
  signal: ctx.signal,
});

switch (wait.status) {
  case "ready":
    return operate(wait.bridge);
  case "aborted":
    return { ok: false, reason: "cancelled", message: "Cancelled." };
  case "timed-out":
    return {
      ok: false,
      reason: "handler_error",
      message: "The panel did not finish opening. Try again in a moment.",
    };
  case "drained":
    return offPageResult("That panel", "workspace");
  case "unavailable":
    return { ok: false, reason: "handler_error", message: "Something went wrong." };
}
```

Supply at least one of `timeoutMs` or `signal`. A requested timeout with no
reachable scheduler resolves `"unavailable"` immediately so the wait cannot
hang.

Adapters do not wrap `drain()`. Call it from your own lifecycle:

```ts
useEffect(() => () => registry.drain(), [registry]);
```

```ts
onDestroy(() => registry.drain());
```
