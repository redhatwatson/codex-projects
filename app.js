const storageKey = "sonsLibraryBooks";
const storageVersion = 2;

const bookForm = document.getElementById("book-form");
const bookList = document.getElementById("book-list");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("filter-status");
const exportButton = document.getElementById("export-books");
const importInput = document.getElementById("import-books");
const backupStatus = document.getElementById("backup-status");
const coverScanInput = document.getElementById("cover-scan");
const scanPreview = document.getElementById("scan-preview");
const scanStatus = document.getElementById("scan-status");
const applyOcrButton = document.getElementById("apply-ocr");
const startCameraButton = document.getElementById("start-camera");
const capturePhotoButton = document.getElementById("capture-photo");
const cameraPreview = document.getElementById("camera-preview");
const captureCanvas = document.getElementById("capture-canvas");
const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const backupUtils = window.BackupUtils;
const tesseractCdn = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let coverScanDataUrl = "";
let ocrSuggestion = null;
let tesseractLoadPromise = null;
let cameraStream = null;
const OCR_MIN_CONFIDENCE = 45;

const normalizeRating = (rating) => {
  const normalized = String(rating ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (!/^[1-5]$/.test(normalized)) {
    return "";
  }

  return normalized;
};

const setBackupStatus = (message, isError = false) => {
  if (!backupStatus) {
    return;
  }

  backupStatus.textContent = message;
  backupStatus.classList.toggle("error", isError);
};

const setScanStatus = (message, isError = false) => {
  if (!scanStatus) {
    return;
  }

  scanStatus.textContent = message;
  scanStatus.classList.toggle("error", isError);
};

const parseOcrText = (rawText) => {
  const lines = rawText
    .split("\n")
    .map((line) => line.replace(/[|*_~`]/g, "").trim())
    .filter(Boolean)
    .filter((line) => /^[\p{L}\p{N}\s.,:'"-]+$/u.test(line))
    .filter((line) => !/^\d+$/.test(line))
    .filter((line) => line.length >= 3);

  if (!lines.length) {
    return null;
  }

  const title = lines
    .filter((line) => !/^by\s+/i.test(line))
    .sort((a, b) => b.length - a.length)[0];

  const byLine = lines.find((line) => /^by\s+/i.test(line));
  const authorFromByLine = byLine ? byLine.replace(/^by\s+/i, "").trim() : "";

  const authorCandidate = lines.find((line) => {
    const words = line.split(/\s+/);
    return words.length >= 2 && words.length <= 5 && words.every((word) => /^[\p{L}.'-]+$/u.test(word));
  });

  const author = authorFromByLine || authorCandidate || "";

  if (!title && !author) {
    return null;
  }

  return { title: title || "", author };
};

const parseOcrLines = (lines) => {
  if (!lines.length) {
    return null;
  }

  return parseOcrText(lines.join("\n"));
};

const extractOcrLines = (ocrResult) => {
  const words = ocrResult?.data?.words ?? [];

  if (!words.length) {
    return [];
  }

  const groupedLines = new Map();

  words.forEach((word) => {
    if (!word?.text || word.confidence < OCR_MIN_CONFIDENCE) {
      return;
    }

    const lineKey = `${word.block_num ?? 0}-${word.par_num ?? 0}-${word.line_num ?? 0}`;

    if (!groupedLines.has(lineKey)) {
      groupedLines.set(lineKey, []);
    }

    groupedLines.get(lineKey).push(word.text.trim());
  });

  return [...groupedLines.values()].map((lineWords) => lineWords.join(" ").trim()).filter(Boolean);
};

const scoreSuggestion = (suggestion) => {
  if (!suggestion) {
    return -1;
  }

  const titleScore = suggestion.title ? suggestion.title.length : 0;
  const authorScore = suggestion.author ? 40 + suggestion.author.length : 0;
  return titleScore + authorScore;
};

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode selected image"));
    image.src = dataUrl;
  });

const preprocessImageForOcr = async (dataUrl) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  const maxDimension = 2200;
  const scale = Math.min(maxDimension / Math.max(image.width, image.height), 2);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const grayscale = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const boosted = grayscale > 145 ? 255 : grayscale < 85 ? 0 : grayscale;
    pixels[i] = boosted;
    pixels[i + 1] = boosted;
    pixels[i + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

const runSingleOcrPass = async (Tesseract, imageData, pageSegMode) => {
  const result = await Tesseract.recognize(imageData, "eng", {
    tessedit_pageseg_mode: String(pageSegMode),
    preserve_interword_spaces: "1",
  });
  const lineBasedSuggestion = parseOcrLines(extractOcrLines(result));
  const fallbackSuggestion = parseOcrText(result?.data?.text || "");
  return lineBasedSuggestion || fallbackSuggestion;
};

const buildBestOcrSuggestion = async (Tesseract, sourceDataUrl) => {
  const preparedDataUrl = await preprocessImageForOcr(sourceDataUrl);
  const [primaryPass, sparsePass] = await Promise.all([
    runSingleOcrPass(Tesseract, preparedDataUrl, 6),
    runSingleOcrPass(Tesseract, preparedDataUrl, 11),
  ]);

  return scoreSuggestion(primaryPass) >= scoreSuggestion(sparsePass) ? primaryPass : sparsePass;
};

const loadTesseract = async () => {
  if (window.Tesseract) {
    return window.Tesseract;
  }

  if (!tesseractLoadPromise) {
    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = tesseractCdn;
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error("Failed to load OCR library"));
      document.head.append(script);
    });
  }

  return tesseractLoadPromise;
};

const runCoverOcr = async () => {
  if (!coverScanDataUrl) {
    setScanStatus("Pick a cover image first.", true);
    return;
  }

  setScanStatus("Scanning cover… this can take a few seconds.");
  applyOcrButton.disabled = true;

  try {
    const Tesseract = await loadTesseract();
    ocrSuggestion = await buildBestOcrSuggestion(Tesseract, coverScanDataUrl);

    if (!ocrSuggestion) {
      setScanStatus("Could not confidently detect title/author. You can still enter them manually.", true);
      return;
    }

    setScanStatus("OCR ready. Click again to apply autofill.");
    applyOcrButton.disabled = false;
  } catch {
    setScanStatus("OCR failed to run. Please try another clear cover image.", true);
    applyOcrButton.disabled = false;
  }
};

const applyOcrSuggestion = () => {
  if (!ocrSuggestion) {
    void runCoverOcr();
    return;
  }

  if (ocrSuggestion.title) {
    titleInput.value = ocrSuggestion.title;
  }

  if (ocrSuggestion.author) {
    authorInput.value = ocrSuggestion.author;
  }

  setScanStatus("Autofill applied. Review and edit before saving.");
};

const stopCameraStream = () => {
  if (!cameraStream) {
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;

  if (cameraPreview) {
    cameraPreview.srcObject = null;
    cameraPreview.hidden = true;
  }

  if (capturePhotoButton) {
    capturePhotoButton.hidden = true;
  }

  if (startCameraButton) {
    startCameraButton.hidden = false;
  }
};

const startCameraCapture = async () => {
  if (!navigator.mediaDevices?.getUserMedia || !cameraPreview) {
    setScanStatus("Camera capture is not supported on this browser. Please upload an image instead.", true);
    return;
  }

  stopCameraStream();

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    capturePhotoButton.hidden = false;
    startCameraButton.hidden = true;
    setScanStatus("Camera is ready. Tap “Capture Photo” when the cover is in frame.");
  } catch {
    setScanStatus("Camera access was blocked. Please allow permission or upload from files.", true);
  }
};

const capturePhoto = () => {
  if (!cameraPreview || !captureCanvas || !cameraStream) {
    return;
  }

  const width = cameraPreview.videoWidth;
  const height = cameraPreview.videoHeight;

  if (!width || !height) {
    setScanStatus("Camera is still starting. Please try again in a moment.", true);
    return;
  }

  captureCanvas.width = width;
  captureCanvas.height = height;
  const context = captureCanvas.getContext("2d");

  if (!context) {
    setScanStatus("Could not process captured image.", true);
    return;
  }

  context.drawImage(cameraPreview, 0, 0, width, height);
  coverScanDataUrl = captureCanvas.toDataURL("image/jpeg", 0.95);
  scanPreview.src = coverScanDataUrl;
  scanPreview.hidden = false;
  ocrSuggestion = null;
  applyOcrButton.disabled = false;
  setScanStatus("Photo captured. Click “Autofill Title + Author” to run OCR.");
  stopCameraStream();
};

const normalizeBook = (book) => ({
  id: typeof book.id === "string" && book.id ? book.id : crypto.randomUUID(),
  title: typeof book.title === "string" ? book.title.trim() : "",
  author: typeof book.author === "string" ? book.author.trim() : "",
  genre: typeof book.genre === "string" ? book.genre.trim() : "",
  readingLevel: typeof book.readingLevel === "string" ? book.readingLevel.trim() : "",
  status: ["to-read", "reading", "finished"].includes(book.status) ? book.status : "to-read",
  rating: normalizeRating(book.rating),
  notes: typeof book.notes === "string" ? book.notes.trim() : "",
});

const sanitizeBooks = (books) =>
  books
    .filter((book) => book && typeof book === "object")
    .map(normalizeBook)
    .filter((book) => book.title && book.author);

const saveBooks = (books) => {
  const payload = {
    version: storageVersion,
    updatedAt: new Date().toISOString(),
    books: sanitizeBooks(books),
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));
};

const readBooks = () => {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    // Migration guard: previous versions stored a raw array.
    if (Array.isArray(parsed)) {
      const migrated = sanitizeBooks(parsed);
      saveBooks(migrated);
      setBackupStatus("Storage upgraded to the latest format.");
      return migrated;
    }

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.books)) {
      const sanitized = sanitizeBooks(parsed.books);

      if (parsed.version !== storageVersion || sanitized.length !== parsed.books.length) {
        saveBooks(sanitized);
      }

      return sanitized;
    }

    setBackupStatus("Stored data format was invalid and has been reset.", true);
    localStorage.removeItem(storageKey);
    return [];
  } catch {
    setBackupStatus("Stored data was corrupted and has been reset.", true);
    localStorage.removeItem(storageKey);
    return [];
  }
};

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const summarize = (books) => {
  const totals = books.reduce(
    (acc, book) => {
      acc.total += 1;
      acc[book.status] += 1;
      if (book.rating) {
        acc.ratedCount += 1;
        acc.ratingTotal += Number(book.rating);
      }
      return acc;
    },
    { total: 0, "to-read": 0, reading: 0, finished: 0, ratedCount: 0, ratingTotal: 0 }
  );

  const averageRating = totals.ratedCount
    ? (totals.ratingTotal / totals.ratedCount).toFixed(1)
    : "-";

  statsEl.innerHTML = `
    <span class="stat-pill">Total: ${totals.total}</span>
    <span class="stat-pill">To Read: ${totals["to-read"]}</span>
    <span class="stat-pill">Reading: ${totals.reading}</span>
    <span class="stat-pill">Finished: ${totals.finished}</span>
    <span class="stat-pill">Avg Rating: ${averageRating}</span>
  `;
};

const renderBooks = () => {
  const books = readBooks();
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  const filteredBooks = books.filter((book) => {
    const matchesStatus = status === "all" || book.status === status;
    const matchesQuery = [book.title, book.author, book.genre, book.readingLevel]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return matchesStatus && matchesQuery;
  });

  summarize(filteredBooks);

  if (!filteredBooks.length) {
    bookList.innerHTML = "<li class='book-item'>No books found. Add one to get started 📖</li>";
    return;
  }

  bookList.innerHTML = filteredBooks
    .map(
      (book) => `
      <li class="book-item">
        <h3>${escapeHtml(book.title)}</h3>
        <p class="book-meta">
          ${escapeHtml(book.author)} • ${escapeHtml(book.genre || "No genre")} •
          ${escapeHtml(book.readingLevel || "No level")} •
          Status: ${escapeHtml(book.status)} • Rating: ${escapeHtml(book.rating || "-")}
        </p>
        ${book.notes ? `<p class="book-notes">📝 ${escapeHtml(book.notes)}</p>` : ""}
        <div class="book-actions">
          <button class="delete-btn" data-id="${book.id}">Delete</button>
        </div>
      </li>
    `
    )
    .join("");
};

const downloadBackup = async () => {
  if (!backupUtils) {
    setBackupStatus("Backup tools are unavailable.", true);
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: storageVersion,
    books: readBooks(),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `sons-library-backup-${stamp}.json`;

  const result = await backupUtils.exportBackupFile({
    payload,
    fileName,
    windowRef: window,
    documentRef: document,
  });

  if (result.status === "saved") {
    setBackupStatus("Backup exported successfully.");
    return;
  }

  if (result.status === "downloaded") {
    setBackupStatus("Backup downloaded to your browser's default download location.");
    return;
  }

  if (result.status === "canceled") {
    setBackupStatus("Backup export canceled.");
    return;
  }

  setBackupStatus("Export failed. Please try again.", true);
};

const handleImport = async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedBooks = Array.isArray(parsed) ? parsed : parsed.books;

    if (!Array.isArray(importedBooks)) {
      throw new Error("Invalid backup format");
    }

    const sanitized = sanitizeBooks(importedBooks);
    saveBooks(sanitized);
    renderBooks();
    setBackupStatus(`Imported ${sanitized.length} books from backup.`);
  } catch {
    setBackupStatus("Import failed. Please choose a valid JSON backup file.", true);
  } finally {
    event.target.value = "";
  }
};

bookForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(bookForm);

  const newBook = {
    id: crypto.randomUUID(),
    title: (formData.get("title") || titleInput.value).trim(),
    author: (formData.get("author") || authorInput.value).trim(),
    genre: document.getElementById("genre").value.trim(),
    readingLevel: document.getElementById("readingLevel").value.trim(),
    status: document.getElementById("status").value,
    rating: document.getElementById("rating").value,
    notes: document.getElementById("notes").value.trim(),
  };

  if (!newBook.title || !newBook.author) {
    return;
  }

  const books = readBooks();
  books.unshift(newBook);
  saveBooks(books);
  bookForm.reset();
  coverScanDataUrl = "";
  ocrSuggestion = null;
  stopCameraStream();
  if (scanPreview) {
    scanPreview.hidden = true;
    scanPreview.removeAttribute("src");
  }
  if (applyOcrButton) {
    applyOcrButton.disabled = true;
  }
  setScanStatus("");
  renderBooks();
});

if (coverScanInput) {
  coverScanInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    ocrSuggestion = null;
    applyOcrButton.disabled = false;

    if (!file) {
      coverScanDataUrl = "";
      scanPreview.hidden = true;
      applyOcrButton.disabled = true;
      setScanStatus("");
      return;
    }

    stopCameraStream();

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (typeof dataUrl !== "string") {
      setScanStatus("Failed to read selected image.", true);
      return;
    }

    coverScanDataUrl = dataUrl;
    scanPreview.src = dataUrl;
    scanPreview.hidden = false;
    setScanStatus("Cover loaded. Click “Autofill Title + Author” to run OCR.");
  });
}

if (applyOcrButton) {
  applyOcrButton.addEventListener("click", applyOcrSuggestion);
}

if (startCameraButton) {
  startCameraButton.addEventListener("click", () => {
    void startCameraCapture();
  });
}

if (capturePhotoButton) {
  capturePhotoButton.addEventListener("click", capturePhoto);
}

bookList.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  if (event.target.classList.contains("delete-btn")) {
    const id = event.target.dataset.id;
    const books = readBooks().filter((book) => book.id !== id);
    saveBooks(books);
    renderBooks();
  }
});

if (exportButton) {
  exportButton.addEventListener("click", downloadBackup);
}

if (importInput) {
  importInput.addEventListener("change", handleImport);
}

window.addEventListener("beforeunload", stopCameraStream);

searchInput.addEventListener("input", renderBooks);
statusFilter.addEventListener("change", renderBooks);

renderBooks();
