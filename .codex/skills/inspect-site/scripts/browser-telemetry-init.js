(() => {
  "use strict";

  const key = "__INSPECT_SITE_TELEMETRY__";
  if (globalThis[key]?.schemaVersion === "1.0.0") {
    return globalThis[key];
  }

  const telemetry = {
    schemaVersion: "1.0.0",
    installedAt: new Date().toISOString(),
    sequence: 0,
    canvas: [],
    webgl: [],
    media: [],
    scroll: []
  };

  const now = () => Math.round(performance.now() * 1000) / 1000;
  const selectorFor = (element) => {
    if (!(element instanceof Element)) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
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
  const record = (collection, entry) => {
    telemetry.sequence += 1;
    telemetry[collection].push({
      sequence: telemetry.sequence,
      atMs: now(),
      ...entry
    });
  };

  if (globalThis.HTMLCanvasElement) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakMap();
    HTMLCanvasElement.prototype.getContext = function inspectSiteGetContext(type, attributes) {
      const context = originalGetContext.apply(this, arguments);
      const normalizedType = String(type).toLowerCase();
      let contextTypes = seen.get(this);
      if (!contextTypes) {
        contextTypes = new Set();
        seen.set(this, contextTypes);
      }
      if (!contextTypes.has(normalizedType)) {
        contextTypes.add(normalizedType);
        const entry = {
          selector: selectorFor(this),
          contextType: normalizedType,
          width: this.width,
          height: this.height,
          attributes: attributes ?? null
        };
        record("canvas", entry);
        if (normalizedType.includes("webgl")) {
          record("webgl", {
            ...entry,
            drawingBufferWidth: context?.drawingBufferWidth ?? null,
            drawingBufferHeight: context?.drawingBufferHeight ?? null
          });
        }
      }
      return context;
    };
  }

  const mediaEventNames = ["play", "pause", "seeking", "seeked", "ended", "ratechange"];
  for (const eventName of mediaEventNames) {
    document.addEventListener(
      eventName,
      (event) => {
        const media = event.target;
        if (!(media instanceof HTMLMediaElement)) return;
        record("media", {
          event: eventName,
          selector: selectorFor(media),
          currentTime: Number.isFinite(media.currentTime) ? media.currentTime : null,
          playbackRate: media.playbackRate,
          paused: media.paused
        });
      },
      true
    );
  }

  document.addEventListener(
    "scroll",
    (event) => {
      const target = event.target === document ? document.scrollingElement : event.target;
      record("scroll", {
        selector: target instanceof Element ? selectorFor(target) : "document",
        x: target instanceof Element ? target.scrollLeft : globalThis.scrollX,
        y: target instanceof Element ? target.scrollTop : globalThis.scrollY
      });
    },
    true
  );

  globalThis[key] = telemetry;
  return telemetry;
})()
