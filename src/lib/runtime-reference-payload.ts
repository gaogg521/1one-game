/** Reference artwork retained through creation; independent runtimes do not consume it implicitly. */
export type RuntimeReferencePayload = { ordinal: number; purpose: string; dataUrl: string };
