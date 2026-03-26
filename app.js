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
const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const backupUtils = window.BackupUtils;
const tesseractCdn = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let coverScanDataUrl = "";
let ocrSuggestion = null;
let tesseractLoadPromise = null;

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
    const result = await Tesseract.recognize(coverScanDataUrl, "eng");
    ocrSuggestion = parseOcrText(result?.data?.text || "");

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

searchInput.addEventListener("input", renderBooks);
statusFilter.addEventListener("change", renderBooks);

renderBooks();
