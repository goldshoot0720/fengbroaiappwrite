/** Lazy-load JSZip only when export/import actually runs. */
export async function loadJSZip() {
  const mod = await import("jszip");
  return mod.default;
}

export type JSZipType = Awaited<ReturnType<typeof loadJSZip>>;
