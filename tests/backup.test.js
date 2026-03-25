const test = require("node:test");
const assert = require("node:assert/strict");

const { exportBackupFile } = require("../backup.js");

test("exportBackupFile uses save picker when available", async () => {
  let writtenBlob = null;
  let closed = false;

  const windowRef = {
    showSaveFilePicker: async () => ({
      createWritable: async () => ({
        write: async (blob) => {
          writtenBlob = blob;
        },
        close: async () => {
          closed = true;
        },
      }),
    }),
  };

  const result = await exportBackupFile({
    payload: { books: [] },
    fileName: "backup.json",
    windowRef,
    documentRef: {},
  });

  assert.equal(result.status, "saved");
  assert.ok(writtenBlob instanceof Blob);
  assert.equal(closed, true);
});

test("exportBackupFile falls back to browser download when picker is unavailable", async () => {
  let clicked = false;
  let removed = false;
  let appended = false;

  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};

  const documentRef = {
    createElement: () => ({
      click: () => {
        clicked = true;
      },
      remove: () => {
        removed = true;
      },
    }),
    body: {
      append: () => {
        appended = true;
      },
    },
  };

  const result = await exportBackupFile({
    payload: { books: [{ title: "A" }] },
    fileName: "backup.json",
    windowRef: {},
    documentRef,
  });

  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;

  assert.equal(result.status, "downloaded");
  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(removed, true);
});

test("exportBackupFile returns canceled when save dialog is dismissed", async () => {
  const windowRef = {
    showSaveFilePicker: async () => {
      const error = new Error("Canceled");
      error.name = "AbortError";
      throw error;
    },
  };

  const result = await exportBackupFile({
    payload: { books: [] },
    fileName: "backup.json",
    windowRef,
    documentRef: {},
  });

  assert.equal(result.status, "canceled");
});
