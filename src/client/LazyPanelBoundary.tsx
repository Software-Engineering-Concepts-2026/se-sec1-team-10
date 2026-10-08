import { Component, type ErrorInfo, type ReactNode } from "react";

export function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|chunkloaderror|loading chunk\s+.+\s+failed/i.test(message);
}

type Props = { children: ReactNode; className?: string };
type State = { error: unknown; hasError: boolean };

export class LazyPanelBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lazy panel failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const chunkFailure = isDynamicImportError(this.state.error);
      return (
        <section className={`lazy-panel-error ${this.props.className ?? ""}`} role="alert">
          <h2>{chunkFailure ? "โหลดส่วนนี้ไม่สำเร็จ" : "ส่วนนี้แสดงผลไม่ได้"}</h2>
          <p>
            {chunkFailure
              ? "ไฟล์ส่วนนี้อาจโหลดไม่สำเร็จจากเครือข่าย หรือเวอร์ชันของแอปในแท็บนี้อาจเก่าแล้ว กรุณาโหลดเวอร์ชันล่าสุดเพื่อใช้งานต่อ"
              : "กรุณาลองโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหา โปรดลองอีกครั้งภายหลัง"}
          </p>
          <p className="lazy-panel-error-note">
            การโหลดใหม่อาจทำให้ข้อมูลที่ยังไม่ได้บันทึกหายไป
          </p>
          {chunkFailure && (
            <>
              <button className="primary" type="button" onClick={() => window.location.reload()}>
                โหลดเวอร์ชันล่าสุด
              </button>
            </>
          )}
          {!chunkFailure && (
            <button className="secondary" type="button" onClick={() => window.location.reload()}>
              โหลดหน้าใหม่
            </button>
          )}
        </section>
      );
    }
    return this.props.children;
  }
}
