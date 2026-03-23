const storageKey = "sonsLibraryBooks";

const bookForm = document.getElementById("book-form");
const bookList = document.getElementById("book-list");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("filter-status");

const readBooks = () => JSON.parse(localStorage.getItem(storageKey) || "[]");
const saveBooks = (books) => localStorage.setItem(storageKey, JSON.stringify(books));

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

searchInput.addEventListener("input", renderBooks);
statusFilter.addEventListener("change", renderBooks);

renderBooks();
