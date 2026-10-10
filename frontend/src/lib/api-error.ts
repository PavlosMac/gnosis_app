export interface ErrorBody {
  /** Machine-readable discriminator, when the backend sent one */
  code?: string;
  /** The backend's message, when it is a plain string. Only shown to users for
      codes whose detail is written for them (e.g. "weak_password"). */
  detail?: string;
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/**
 * The `code` and string `detail` of a FastAPI error body (`{detail, code?}`).
 * Takes the raw body text so the caller reads the response exactly once;
 * anything that is not a JSON object (a proxy's HTML error page) is empty, and
 * a non-string detail (FastAPI's validation-error list) is dropped.
 */
export const readErrorBody = (bodyText: string): ErrorBody => {
  try {
    const body: unknown = JSON.parse(bodyText);
    if (typeof body !== "object" || body === null || Array.isArray(body)) return {};
    const { code, detail } = body as Record<string, unknown>;
    const result: ErrorBody = {};
    const codeValue = nonEmptyString(code);
    const detailValue = nonEmptyString(detail);
    if (codeValue) result.code = codeValue;
    if (detailValue) result.detail = detailValue;
    return result;
  } catch {
    return {};
  }
};

/** Just the `code` — see `readErrorBody` */
export const readErrorCode = (bodyText: string): string | undefined =>
  readErrorBody(bodyText).code;
