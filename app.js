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

const setBackupStatus = (message, isError = false) => {
  if (!backupStatus) {
    return;
  }

  backupStatus.textContent = message;
  backupStatus.classList.toggle("error", isError);
};

const normalizeBook = (book) => ({
  id: typeof book.id === "string" && book.id ? book.id : crypto.randomUUID(),
  title: typeof book.title === "string" ? book.title.trim() : "",
  author: typeof book.author === "string" ? book.author.trim() : "",
  genre: typeof book.genre === "string" ? book.genre.trim() : "",
  readingLevel: typeof book.readingLevel === "string" ? book.readingLevel.trim() : "",
  status: ["to-read", "reading", "finished"].includes(book.status) ? book.status : "to-read",
  rating: typeof book.rating === "string" || typeof book.rating === "number" ? String(book.rating) : "",
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
          Status: ${escapeHtml(book.status)} • Rating: ${book.rating || "-"}
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

const downloadBackup = () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: storageVersion,
    books: readBooks(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `sons-library-backup-${stamp}.json`;
  link.click();

  URL.revokeObjectURL(url);
  setBackupStatus("Backup exported successfully.");
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
    title: (formData.get("title") || document.getElementById("title").value).trim(),
    author: (formData.get("author") || document.getElementById("author").value).trim(),
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
  renderBooks();
});

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
