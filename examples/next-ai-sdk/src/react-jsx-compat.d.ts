import type { JSX as ReactJSX } from "react";

// Next 16's generated typed-route declaration still names the global JSX
// namespace. React 19 moved that namespace under the `react` module, so bridge
// the two until Next emits `React.JSX` directly.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export {};
