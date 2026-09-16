import { afterEach, describe, expect, it } from "vitest";

import { mount, registry, styleSheet } from "./harness.js";

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("AnchorRegistry.readUntrusted", () => {
  it("returns not-registered before any other gate", () => {
    const anchors = registry();
    expect(anchors.readUntrusted("notes", { maxChars: 80 })).toEqual({
      status: "not-registered",
      text: "",
      truncated: false,
      visited: 0,
      report: null,
    });
  });

  it("returns not-readable before visibility when no registration is declared readable", () => {
    const anchors = registry();
    const hidden: HTMLElement = mount("section", "secret");
    hidden.style.display = "none";
    anchors.register("billing", hidden);

    const outcome = anchors.readUntrusted("billing", { maxChars: 80 });
    expect(outcome.status).toBe("not-readable");
    expect(outcome.text).toBe("");
    expect(outcome.visited).toBe(0);
    expect(outcome.report?.styledOutBy).toBe("display");
  });

  it("returns not-rendered for a readable key whose survivors are hidden", () => {
    const anchors = registry();
    const hidden: HTMLElement = mount("section", "notes");
    hidden.setAttribute("hidden", "");
    anchors.register("notes", hidden, { readable: true });

    const outcome = anchors.readUntrusted("notes", { maxChars: 80 });
    expect(outcome.status).toBe("not-rendered");
    expect(outcome.text).toBe("");
  });

  it("returns busy when the winner or an ancestor is aria-busy", () => {
    const anchors = registry();
    const surface: HTMLElement = mount();
    surface.setAttribute("aria-busy", "true");
    const summary: HTMLElement = document.createElement("section");
    summary.textContent = "$12.00";
    surface.appendChild(summary);
    anchors.register("cart-summary", summary, { readable: true });

    expect(anchors.readUntrusted("cart-summary", { maxChars: 80 }).status).toBe(
      "busy",
    );
    expect(
      anchors.readUntrusted("cart-summary", {
        maxChars: 80,
        refuseWhileBusy: false,
      }).status,
    ).toBe("read");
  });

  it("reads live visible text, skips banned tagNames, and sanitizes with ellipsis", () => {
    styleSheet(".dup { display: none; }");
    const anchors = registry();
    const root: HTMLElement = mount("section");
    const visible: HTMLElement = document.createElement("p");
    visible.textContent = "visible copy";
    const hiddenDup: HTMLElement = document.createElement("p");
    hiddenDup.className = "dup";
    hiddenDup.textContent = "hidden duplicate that a clone would include";
    const script: HTMLScriptElement = document.createElement("script");
    script.type = "application/json";
    script.textContent = "{\"injected\":true}";
    const svg: SVGSVGElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    const label: SVGTextElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    label.textContent = "icon label";
    svg.appendChild(label);
    root.append(visible, hiddenDup, script, svg);
    anchors.register("notes", root, { readable: true });

    const outcome = anchors.readUntrusted("notes", { maxChars: 80 });
    expect(outcome.status).toBe("read");
    expect(outcome.text).toBe("visible copy");
    expect(outcome.text).not.toContain("hidden duplicate");
    expect(outcome.text).not.toContain("injected");
    expect(outcome.text).not.toContain("icon label");
    expect(outcome.truncated).toBe(false);
    expect(outcome.visited).toBeGreaterThan(0);
  });

  it("returns empty when every visible text node is whitespace", () => {
    const anchors = registry();
    const root: HTMLElement = mount("section", "   ");
    anchors.register("notes", root, { readable: true });
    expect(anchors.readUntrusted("notes", { maxChars: 40 }).status).toBe("empty");
  });

  it("bounds with sanitizeText ellipsis and reports truncated", () => {
    const anchors = registry();
    const root: HTMLElement = mount("section", "abcdefghijklmnopqrstuvwxyz");
    anchors.register("notes", root, { readable: true });

    const outcome = anchors.readUntrusted("notes", { maxChars: 8 });
    expect(outcome.status).toBe("read");
    expect(outcome.text.endsWith("…")).toBe(true);
    expect(outcome.text.length).toBeLessThanOrEqual(8);
    expect(outcome.truncated).toBe(true);
  });

  it("stops the live walk at maxNodes", () => {
    const anchors = registry();
    const root: HTMLElement = mount("section");
    for (let index = 0; index < 8; index += 1) {
      const child: HTMLElement = document.createElement("span");
      child.textContent = `n${index}`;
      root.appendChild(child);
    }
    anchors.register("notes", root, { readable: true });

    const outcome = anchors.readUntrusted("notes", { maxChars: 200, maxNodes: 3 });
    expect(outcome.visited).toBe(3);
    expect(outcome.truncated).toBe(true);
  });

  it("skips style, noscript, template, iframe, and object by tagName", () => {
    const anchors = registry();
    const root: HTMLElement = mount("section");
    const visible: HTMLElement = document.createElement("p");
    visible.textContent = "keep";
    const style: HTMLStyleElement = document.createElement("style");
    style.textContent = ".x{color:red}";
    const noscript: HTMLElement = document.createElement("noscript");
    noscript.textContent = "no script copy";
    const template: HTMLTemplateElement = document.createElement("template");
    const stamped: HTMLElement = document.createElement("p");
    stamped.textContent = "template copy";
    template.content.appendChild(stamped);
    const iframe: HTMLIFrameElement = document.createElement("iframe");
    const object: HTMLObjectElement = document.createElement("object");
    object.textContent = "object copy";
    root.append(visible, style, noscript, template, iframe, object);
    anchors.register("notes", root, { readable: true });

    const outcome = anchors.readUntrusted("notes", { maxChars: 80 });
    expect(outcome.status).toBe("read");
    expect(outcome.text).toBe("keep");
    expect(outcome.text).not.toContain("no script");
    expect(outcome.text).not.toContain("template copy");
    expect(outcome.text).not.toContain("object copy");
  });

  it("prefers a readable survivor contained by within", () => {
    const anchors = registry();
    const list: HTMLElement = mount("section", "board copy");
    const panel: HTMLElement = mount("div");
    const notes: HTMLElement = document.createElement("section");
    notes.textContent = "panel copy";
    panel.appendChild(notes);
    anchors.register("notes", list, { readable: true });
    anchors.register("notes", notes, { readable: true });

    const unconstrained = anchors.readUntrusted("notes", { maxChars: 80 });
    expect(unconstrained.text).toBe("board copy");

    const constrained = anchors.readUntrusted("notes", {
      maxChars: 80,
      within: panel,
    });
    expect(constrained.status).toBe("read");
    expect(constrained.text).toBe("panel copy");
  });

  it("does not read a rendered sibling that was not declared readable", () => {
    const anchors = registry();
    const secret: HTMLElement = mount("section", "credit limit");
    const notes: HTMLElement = mount("section", "call the buyer");
    notes.style.display = "none";
    anchors.register("deal", secret);
    anchors.register("deal", notes, { readable: true });

    const outcome = anchors.readUntrusted("deal", { maxChars: 80 });
    expect(outcome.status).toBe("not-rendered");
    expect(outcome.text).toBe("");
  });
});
