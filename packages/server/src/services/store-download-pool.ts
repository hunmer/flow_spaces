/** Stop scheduling on failure and drain active downloads before reporting the error. */
export async function downloadStoreFiles<T>(files: readonly T[], download: (file: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failed = false;
  let failure: unknown;
  const worker = async () => {
    while (!failed && next < files.length) {
      const file = files[next++];
      try {
        await download(file);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  if (failed) throw failure;
}
