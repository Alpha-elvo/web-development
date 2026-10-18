
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");
const body = document.body;

const DRAFT_KEY = "quick-notes-draft";
const THEME_KEY = "quick-notes-theme";

function updateCounts() {
  const text = noteText.value;
  const characters = text.length;

  // Ignore empty spaces when counting words.
  const trimmedText = text.trim();
  const words = trimmedText === ""
    ? 0
    : trimmedText.split(/\s+/).length;

  charCount.textContent = `${characters} / 200 characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.toggle("warning", characters > 180);
  charCount.classList.toggle("over", characters > 200);
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, noteText.value);
}

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
}

function updateThemeButton() {
  const isDark = body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

function toggleTheme() {
  body.classList.toggle("dark");

  const isDark = body.classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  updateThemeButton();
}

// Restore saved data when the page loads.
const savedDraft = localStorage.getItem(DRAFT_KEY);

if (savedDraft !== null) {
  noteText.value = savedDraft;
}

const savedTheme = localStorage.getItem(THEME_KEY);

if (savedTheme === "dark") {
  body.classList.add("dark");
} else {
  body.classList.remove("dark");
}

updateThemeButton();
updateCounts();

// Update the counters and save on every input event.
noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

// Clear the note when the Clear button is clicked.
clearBtn.addEventListener("click", clearNote);

// Escape clears the note while the textarea is focused.
noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

// Toggle and remember the selected theme.
themeToggle.addEventListener("click", toggleTheme);

