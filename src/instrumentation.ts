export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDataDirs } = await import("@/lib/files");
    ensureDataDirs();
  }
}
