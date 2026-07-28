(() => {
  "use strict";

  const options = globalThis.__INSPECT_SITE_OPTIONS__ ?? {};
  const scenario =
    typeof options.scenario === "string" && options.scenario.trim()
      ? options.scenario.trim()
      : "unassigned";
  const adapter =
    typeof options.adapter === "string" && options.adapter.trim()
      ? options.adapter.trim()
      : "unassigned";
  const root =
    typeof options.rootSelector === "string"
      ? document.querySelector(options.rootSelector)
      : document.documentElement;
  if (!root) {
    throw new Error(`inspect-site root not found: ${options.rootSelector}`);
  }

  const styleProperties = [
    "display",
    "position",
    "inset",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "box-sizing",
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "gap",
    "row-gap",
    "column-gap",
    "overflow",
    "overflow-x",
    "overflow-y",
    "grid-template-columns",
    "grid-template-rows",
    "grid-auto-flow",
    "align-items",
    "align-content",
    "align-self",
    "justify-content",
    "justify-items",
    "justify-self",
    "flex-direction",
    "flex-wrap",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "order",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "text-decoration-line",
    "white-space",
    "word-break",
    "color",
    "background-color",
    "background-image",
    "background-position",
    "background-size",
    "background-repeat",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "box-shadow",
    "opacity",
    "visibility",
    "clip-path",
    "mask-image",
    "-webkit-mask-image",
    "filter",
    "backdrop-filter",
    "mix-blend-mode",
    "transform",
    "transform-origin",
    "transition-property",
    "transition-duration",
    "transition-delay",
    "transition-timing-function",
    "animation-name",
    "animation-duration",
    "animation-delay",
    "animation-timing-function",
    "animation-iteration-count",
    "object-fit",
    "object-position",
    "aspect-ratio",
    "pointer-events",
    "cursor"
  ];
  const styleCache = new WeakMap();
  const unknowns = [];
  let unknownCounter = 0;
  const addUnknown = (question, impact) => {
    unknownCounter += 1;
    unknowns.push({
      id: `capture-unknown-${unknownCounter}`,
      question,
      impact,
      status: "open"
    });
  };
  if (scenario === "unassigned") {
    addUnknown(
      "Which capture scenario produced this probe?",
      "The capture cannot be replayed deterministically until a scenario id is assigned."
    );
  }
  if (adapter === "unassigned") {
    addUnknown(
      "Which browser adapter and version produced this probe?",
      "Rasterization, input, timing, and browser capability differences cannot be reproduced."
    );
  }

  const round = (number) => Math.round(number * 1000) / 1000;
  const finite = (value) => (Number.isFinite(value) ? value : null);
  const escapeCss = (value) =>
    globalThis.CSS?.escape
      ? CSS.escape(value)
      : String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  const isUnique = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  const selectorFor = (element) => {
    if (element.id) {
      const selector = `#${escapeCss(element.id)}`;
      if (isUnique(selector)) return selector;
    }
    for (const attribute of ["data-testid", "data-test", "data-cy"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const selector = `[${attribute}="${escapeCss(value)}"]`;
      if (isUnique(selector)) return selector;
    }
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      const tag = current.localName;
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((item) => item.localName === tag)
        : [];
      const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
      parts.unshift(`${tag}${suffix}`);
      current = current.parentElement;
    }
    return parts.join(" > ");
  };
  const styleFor = (element) => {
    let style = styleCache.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styleCache.set(element, style);
    }
    return style;
  };
  const styleArray = (style) => styleProperties.map((property) => style.getPropertyValue(property));
  const pseudoFor = (element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    const content = style.getPropertyValue("content");
    const background = style.getPropertyValue("background-image");
    const mask = `${style.getPropertyValue("mask-image")} ${style.getPropertyValue(
      "-webkit-mask-image"
    )}`;
    if (
      (content === "none" || content === "normal" || content === "") &&
      (background === "none" || background === "") &&
      !mask.split(/\s+/).some((value) => value && value !== "none")
    ) {
      return null;
    }
    return { style: styleArray(style) };
  };
  const attributesFor = (element) => {
    const entries = Array.from(element.attributes)
      .filter(
        (attribute) =>
          options.includeFormValues === true ||
          attribute.name !== "value" ||
          !["input", "textarea", "select"].includes(element.localName)
      )
      .map((attribute) => [attribute.name, attribute.value])
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries);
  };
  const directTextFor = (element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.nodeValue ?? "")
      .join("")
      .trim();
  const statesFor = (element) => {
    const values = [];
    const booleanProperties = [
      ["checked", "checked"],
      ["disabled", "disabled"],
      ["open", "open"],
      ["readOnly", "readonly"],
      ["required", "required"],
      ["selected", "selected"]
    ];
    for (const [property, label] of booleanProperties) {
      if (property in element && element[property] === true) values.push(label);
    }
    for (const attribute of ["aria-expanded", "aria-hidden", "aria-pressed", "aria-selected"]) {
      if (element.hasAttribute(attribute)) {
        values.push(`${attribute}=${element.getAttribute(attribute)}`);
      }
    }
    if (document.activeElement === element) values.push("focus");
    try {
      if (element.matches(":focus-within")) values.push("focus-within");
      if (element.matches(":hover")) values.push("hover");
      if (element.matches(":target")) values.push("target");
    } catch {
      // Unsupported state selectors do not invalidate the rest of the probe.
    }
    return [...new Set(values)].sort();
  };

  const traversal = [];
  const stack = [{ element: root, parent: null }];
  while (stack.length) {
    const current = stack.pop();
    const id = traversal.length;
    traversal.push({ id, parent: current.parent, element: current.element });
    const lightChildren = Array.from(current.element.children);
    for (let index = lightChildren.length - 1; index >= 0; index -= 1) {
      stack.push({ element: lightChildren[index], parent: id });
    }
    if (current.element.shadowRoot) {
      const shadowChildren = Array.from(current.element.shadowRoot.children);
      for (let index = shadowChildren.length - 1; index >= 0; index -= 1) {
        stack.push({ element: shadowChildren[index], parent: id });
      }
    }
  }

  const states = [];
  const nodes = traversal.map(({ id, parent, element }) => {
    const style = styleFor(element);
    const rect = element.getBoundingClientRect();
    const stateValues = statesFor(element);
    const selector = selectorFor(element);
    if (stateValues.length) states.push({ selector, values: stateValues });
    const before = pseudoFor(element, "::before");
    const after = pseudoFor(element, "::after");
    const pseudo = {};
    if (before) pseudo.before = before;
    if (after) pseudo.after = after;
    const record = {
      id,
      parent,
      selector,
      tag: element.localName,
      attributes: attributesFor(element),
      text: directTextFor(element),
      rect: {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height)
      },
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0,
      style: styleArray(style)
    };
    if (Object.keys(pseudo).length) record.pseudo = pseudo;
    if (element.shadowRoot) record.shadowRoot = "open";
    return record;
  });

  const breakpoints = new Map();
  const assets = [];
  const assetKeys = new Set();
  const addAsset = (asset) => {
    const key = JSON.stringify(asset);
    if (!assetKeys.has(key)) {
      assetKeys.add(key);
      assets.push(asset);
    }
  };
  const resolveUrl = (value) => {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value;
    }
  };
  const extractCssUrls = (value) => {
    const urls = [];
    const expression = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g;
    let match;
    while ((match = expression.exec(value))) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      if (raw) urls.push(resolveUrl(raw));
    }
    return urls;
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = Array.from(sheet.cssRules);
    } catch {
      addUnknown(
        `CSS rules were not readable for ${sheet.href ?? "an inline stylesheet"}.`,
        "Media queries and font-face declarations from this stylesheet may be incomplete."
      );
      continue;
    }
    const ruleStack = [...rules].reverse();
    while (ruleStack.length) {
      const rule = ruleStack.pop();
      const mediaText = rule.media?.mediaText;
      if (mediaText) {
        let matches = false;
        try {
          matches = matchMedia(mediaText).matches;
        } catch {
          // Keep the query even when the browser cannot evaluate it.
        }
        breakpoints.set(mediaText, matches);
      }
      if (rule.cssRules) {
        const children = Array.from(rule.cssRules);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          ruleStack.push(children[index]);
        }
      }
      if (rule.style && /^@font-face/i.test(rule.cssText)) {
        for (const url of extractCssUrls(rule.style.getPropertyValue("src"))) {
          addAsset({
            kind: "font",
            url,
            family: rule.style.getPropertyValue("font-family").replace(/^['"]|['"]$/g, ""),
            weight: rule.style.getPropertyValue("font-weight"),
            style: rule.style.getPropertyValue("font-style")
          });
        }
      }
    }
  }

  const selectorByElement = new Map(traversal.map(({ element }) => [element, selectorFor(element)]));
  for (const element of traversal.map(({ element }) => element)) {
    const selector = selectorByElement.get(element);
    const tag = element.localName;
    if (tag === "img") {
      addAsset({
        kind: "image",
        selector,
        url: element.currentSrc || resolveUrl(element.getAttribute("src") || ""),
        src: element.getAttribute("src") || "",
        srcset: element.getAttribute("srcset") || "",
        sizes: element.getAttribute("sizes") || "",
        loading: element.loading || "",
        intrinsicWidth: element.naturalWidth,
        intrinsicHeight: element.naturalHeight
      });
    }
    if (tag === "source" && element.parentElement?.localName === "picture") {
      addAsset({
        kind: "pictureSource",
        selector,
        url: resolveUrl(element.getAttribute("srcset") || element.getAttribute("src") || ""),
        srcset: element.getAttribute("srcset") || "",
        sizes: element.getAttribute("sizes") || "",
        media: element.getAttribute("media") || "",
        type: element.getAttribute("type") || ""
      });
    }
    if (tag === "video" || tag === "audio") {
      addAsset({
        kind: tag,
        selector,
        url: element.currentSrc || resolveUrl(element.getAttribute("src") || ""),
        poster: tag === "video" ? resolveUrl(element.getAttribute("poster") || "") : "",
        preload: element.preload,
        autoplay: element.autoplay,
        loop: element.loop,
        muted: element.muted,
        controls: element.controls
      });
    }
    if (tag === "source" && ["video", "audio"].includes(element.parentElement?.localName)) {
      addAsset({
        kind: "mediaSource",
        selector,
        url: resolveUrl(element.getAttribute("src") || ""),
        type: element.getAttribute("type") || "",
        media: element.getAttribute("media") || ""
      });
    }
    if (tag === "track") {
      addAsset({
        kind: "track",
        selector,
        url: resolveUrl(element.getAttribute("src") || ""),
        trackKind: element.getAttribute("kind") || "",
        srclang: element.getAttribute("srclang") || ""
      });
    }
    if (tag === "canvas") {
      addAsset({
        kind: "canvas",
        selector,
        width: element.width,
        height: element.height,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight
      });
    }
    if (tag === "iframe") {
      addAsset({
        kind: "iframe",
        selector,
        url: resolveUrl(element.getAttribute("src") || "")
      });
      addUnknown(
        `Iframe DOM was not included for ${selector}.`,
        "Nested content requires a separate same-origin or frame-scoped scenario."
      );
    }
    if (tag === "link" && element.getAttribute("rel")?.split(/\s+/).includes("manifest")) {
      addAsset({
        kind: "manifest",
        selector,
        url: resolveUrl(element.getAttribute("href") || "")
      });
    }
    const animationKind =
      tag.includes("rive") || element.hasAttribute("data-rive")
        ? "rive"
        : tag.includes("lottie") ||
            element.hasAttribute("data-lottie") ||
            element.hasAttribute("data-animation-path")
          ? "lottie"
          : null;
    if (animationKind) {
      const animationUrl =
        element.getAttribute("src") ||
        element.getAttribute("data-src") ||
        element.getAttribute("data-animation-path") ||
        element.getAttribute("data-rive") ||
        "";
      addAsset({
        kind: animationKind,
        selector,
        url: resolveUrl(animationUrl)
      });
    }
    const style = styleFor(element);
    for (const property of [
      "background-image",
      "border-image-source",
      "cursor",
      "list-style-image",
      "mask-image",
      "-webkit-mask-image"
    ]) {
      for (const url of extractCssUrls(style.getPropertyValue(property))) {
        addAsset({ kind: "cssUrl", selector, property, url });
      }
    }
  }

  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: round(entry.startTime),
      duration: round(entry.duration),
      transferSize: entry.transferSize ?? 0,
      decodedBodySize: entry.decodedBodySize ?? 0
    }))
    .sort(
      (left, right) =>
        left.startTime - right.startTime ||
        left.name.localeCompare(right.name) ||
        left.initiatorType.localeCompare(right.initiatorType)
    );
  for (const resource of resources) {
    if (
      /\.json(?:$|\?)/i.test(resource.name) &&
      /(lottie|animation|rive)/i.test(resource.name)
    ) {
      addAsset({ kind: "animationData", url: resource.name });
    }
  }

  const animations = document
    .getAnimations({ subtree: true })
    .map((animation) => {
      const target = animation.effect?.target;
      const timing = animation.effect?.getComputedTiming?.() ?? {};
      return {
        selector: target instanceof Element ? selectorFor(target) : null,
        playState: animation.playState,
        currentTime: finite(animation.currentTime),
        startTime: finite(animation.startTime),
        playbackRate: animation.playbackRate,
        delay: finite(timing.delay),
        duration: finite(timing.duration),
        endTime: finite(timing.endTime),
        iterations: finite(timing.iterations)
      };
    })
    .sort((left, right) => (left.selector ?? "").localeCompare(right.selector ?? ""));
  const media = Array.from(document.querySelectorAll("video,audio")).map((element) => ({
    selector: selectorFor(element),
    currentTime: finite(element.currentTime),
    duration: finite(element.duration),
    playbackRate: element.playbackRate,
    paused: element.paused,
    ended: element.ended,
    readyState: element.readyState,
    networkState: element.networkState
  }));
  const initTelemetry = globalThis.__INSPECT_SITE_TELEMETRY__;
  const canvasTelemetry = initTelemetry?.canvas ? structuredClone(initTelemetry.canvas) : [];
  const webglTelemetry = initTelemetry?.webgl ? structuredClone(initTelemetry.webgl) : [];
  if (assets.some((asset) => asset.kind === "canvas") && !initTelemetry) {
    addUnknown(
      "Was a 2D, bitmap, WebGL, or WebGPU context created before the probe ran?",
      "Canvas implementation and draw timing are incomplete without the init telemetry hook."
    );
  }
  for (const event of webglTelemetry) {
    addAsset({
      kind: "webgl",
      selector: event.selector,
      contextType: event.contextType,
      width: event.width,
      height: event.height
    });
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const cssVariables = Array.from(rootStyle)
    .filter((property) => property.startsWith("--"))
    .sort()
    .map((property) => [property, rootStyle.getPropertyValue(property).trim()]);
  const scrollElement = document.scrollingElement ?? document.documentElement;
  assets.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      (left.selector ?? "").localeCompare(right.selector ?? "") ||
      (left.url ?? "").localeCompare(right.url ?? "")
  );

  return {
    schemaVersion: "1.0.0",
    adapter,
    source: {
      url: location.href,
      route: `${location.pathname}${location.search}${location.hash}`,
      referrer: document.referrer
    },
    capturedAt: new Date().toISOString(),
    viewport: {
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      deviceScaleFactor: globalThis.devicePixelRatio || 1,
      orientation: globalThis.innerWidth >= globalThis.innerHeight ? "landscape" : "portrait",
      reducedMotion: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduce"
        : "no-preference",
      colorScheme: globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : globalThis.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "no-preference",
      hasTouch: (globalThis.navigator?.maxTouchPoints ?? 0) > 0
    },
    scenario,
    evidenceLevel: "measured",
    styleProperties,
    document: {
      title: document.title,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      readyState: document.readyState,
      doctype: document.doctype?.name ?? null,
      baseURI: document.baseURI,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      cssVariables: Object.fromEntries(cssVariables),
      traversal: "flat-preorder-all-elements"
    },
    breakpoints: Array.from(breakpoints, ([query, matches]) => ({ query, matches })).sort((left, right) =>
      left.query.localeCompare(right.query)
    ),
    nodes,
    states,
    assets,
    telemetry: {
      scroll: {
        x: globalThis.scrollX,
        y: globalThis.scrollY,
        scrollWidth: scrollElement.scrollWidth,
        scrollHeight: scrollElement.scrollHeight,
        clientWidth: scrollElement.clientWidth,
        clientHeight: scrollElement.clientHeight
      },
      resources,
      animations,
      media,
      canvas: canvasTelemetry,
      webgl: webglTelemetry
    },
    unknowns
  };
})()
