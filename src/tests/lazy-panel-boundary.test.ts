import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isDynamicImportError } from "../client/LazyPanelBoundary";
import { LazyPanelBoundary } from "../client/LazyPanelBoundary";

function renderFallback(error: unknown) {
  const boundary = new LazyPanelBoundary({ children: null });
  boundary.state = { error, hasError: true };
  return renderToStaticMarkup(boundary.render());
}

describe("lazy panel error classification", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/MealPanel.js",
    "Importing a module script failed.",
    "Loading chunk 42 failed.",
    "ChunkLoadError: Loading CSS chunk failed",
  ])("recognizes chunk loading errors: %s", (message) => {
    expect(isDynamicImportError(new TypeError(message))).toBe(true);
  });

  it.each([
    "Cannot read properties of undefined",
    "Network request failed",
    "Unexpected token in JSON",
  ])("does not label unrelated errors as stale code: %s", (message) => {
    expect(isDynamicImportError(new Error(message))).toBe(false);
  });

  it("renders a separate network or stale-version recovery message", () => {
    const html = renderFallback(new TypeError("Failed to fetch dynamically imported module"));
    expect(html).toContain("ไฟล์ส่วนนี้อาจโหลดไม่สำเร็จจากเครือข่าย");
    expect(html).toContain("เวอร์ชันของแอปในแท็บนี้อาจเก่าแล้ว");
    expect(html).toContain("การโหลดใหม่อาจทำให้ข้อมูลที่ยังไม่ได้บันทึกหายไป");
    expect(html).toContain("โหลดเวอร์ชันล่าสุด");
    expect(html).not.toContain("โหลดหน้าใหม่</button>");
  });

  it("keeps ordinary render failures distinct and warns before reloading", () => {
    const html = renderFallback(new Error("Cannot read properties of undefined"));
    expect(html).toContain("ส่วนนี้แสดงผลไม่ได้");
    expect(html).toContain("การโหลดใหม่อาจทำให้ข้อมูลที่ยังไม่ได้บันทึกหายไป");
    expect(html).toContain("โหลดหน้าใหม่");
    expect(html).not.toContain("โหลดเวอร์ชันล่าสุด");
  });

  it("renders a fallback even when a component throws a falsy value", () => {
    const boundary = new LazyPanelBoundary({ children: null });
    boundary.state = { error: null, hasError: true };
    expect(renderToStaticMarkup(boundary.render())).toContain("ส่วนนี้แสดงผลไม่ได้");
  });
});
