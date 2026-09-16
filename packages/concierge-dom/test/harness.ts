import { createAnchorRegistry } from "../src/index.js";
import type { AnchorRegistry, AnchorRegistryOptions } from "../src/index.js";

export function mount(
  tag: string = "div",
  text: string = "",
): HTMLElement {
  const element: HTMLElement = document.createElement(tag);
  if (text.length > 0) {
    element.textContent = text;
  }
  document.body.appendChild(element);
  return element;
}

export function registry(options: AnchorRegistryOptions = {}): AnchorRegistry {
  return createAnchorRegistry({ id: "test", ...options });
}

export function styleSheet(css: string): HTMLStyleElement {
  const style: HTMLStyleElement = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}
