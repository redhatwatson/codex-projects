(function (globalScope, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.BackupUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const createBackupBlob = (payload) =>
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });

  const triggerDownload = ({ blob, fileName, documentRef }) => {
    const url = URL.createObjectURL(blob);
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = fileName;
    documentRef.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportBackupFile = async ({ payload, fileName, windowRef, documentRef }) => {
    const blob = createBackupBlob(payload);

    try {
      if ("showSaveFilePicker" in windowRef) {
        const handle = await windowRef.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "JSON backup",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { status: "saved" };
      }

      triggerDownload({ blob, fileName, documentRef });
      return { status: "downloaded" };
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { status: "canceled" };
      }

      return { status: "error", error };
    }
  };

  return {
    createBackupBlob,
    exportBackupFile,
  };
});
