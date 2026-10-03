let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  return notes.filter((note) =>
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];

  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }

  return longest;
}

function countByCategory() {
  const counts = {};

  for (const note of notes) {
    if (!counts[note.category]) {
      counts[note.category] = 0;
    }

    counts[note.category]++;
  }

  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const word = notes.length === 1 ? "note" : "notes";

  return `${notes.length} ${word}: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}

function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();

  return notes.some(
    (note) => note.text.trim().toLowerCase() === normalizedText
  );
}

function addNote(text, category) {
  const trimmedText = text.trim();

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note must be between 1 and 200 characters.");
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log("Note already exists.");
    return false;
  }

  if (!["personal", "work", "study"].includes(category)) {
    console.log("Invalid category.");
    return false;
  }

  const nextId =
    notes.length > 0 ? Math.max(...notes.map((note) => note.id)) + 1 : 1;

  notes.push({
    id: nextId,
    text: trimmedText,
    category: category,
  });

  return true;
}

// searchNotes tests
console.log(searchNotes("javascript")); // Expected: [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]
console.log(searchNotes("python")); // Expected: []

console.log(longestNote()); // Expected: note with id 3

const savedNotes = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotes;

// countByCategory tests
console.log(countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }
console.log(Object.keys(countByCategory()).length); // Expected: 3

// getSummary tests
console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
console.log(notes.length === 5); // Expected: true

// isDuplicate tests
console.log(isDuplicate(" Buy milk and bread ")); // Expected: true
console.log(isDuplicate("Buy vegetables")); // Expected: false

// addNote tests
console.log(addNote("Read JavaScript documentation", "study")); // Expected: true
console.log(addNote(" Buy milk and bread ", "personal")); // Expected: false
