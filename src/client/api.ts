export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string[]> = {}) { super(message); }
}
export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch { throw new ApiError('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่', 0); }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({ message: 'ระบบไม่พร้อมใช้งาน กรุณาลองใหม่' }));
  if (!response.ok) throw new ApiError(data.message ?? 'เกิดข้อผิดพลาด', response.status, data.errors);
  return data as T;
}
