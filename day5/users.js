const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusElement = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let allUsers = [];

async function loadUsers() {
  loadButton.disabled = true;
  statusElement.textContent = "Loading users...";
  usersList.replaceChildren();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const users = await response.json();

    if (!Array.isArray(users)) {
      throw new Error("Unexpected API response.");
    }

    allUsers = users;
    renderUsers(getFilteredUsers());

    if (allUsers.length === 0) {
      statusElement.textContent = "The API returned no users.";
    } else if (getFilteredUsers().length === 0) {
      statusElement.textContent = "No users match your filter.";
    } else {
      statusElement.textContent = `Loaded ${allUsers.length} users.`;
    }
  } catch (error) {
    allUsers = [];
    renderUsers([]);
    statusElement.textContent =
      `Unable to load users: ${error.message}`;
  } finally {
    loadButton.disabled = false;
  }
}

function renderUsers(list) {
  usersList.replaceChildren();

  for (const user of list) {
    const item = document.createElement("li");
    const name = document.createElement("h2");
    const email = document.createElement("p");
    const city = document.createElement("p");
    const company = document.createElement("p");

    name.textContent = user.name;
    email.textContent = `Email: ${user.email}`;
    city.textContent = `City: ${user.address.city}`;
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  }

  if (allUsers.length > 0 && list.length === 0) {
    statusElement.textContent = "No users match your filter.";
  }
}

function getFilteredUsers() {
  const query = filterInput.value.trim().toLowerCase();

  return allUsers.filter(user =>
    user.name.toLowerCase().includes(query)
  );
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (allUsers.length === 0) return;

  const filteredUsers = getFilteredUsers();
  renderUsers(filteredUsers);

  if (filteredUsers.length > 0) {
    statusElement.textContent =
      `Showing ${filteredUsers.length} of ${allUsers.length} users.`;
  }
});
