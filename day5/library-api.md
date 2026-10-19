# Library Books API Design

## Overview

The API manages books in a library.

- Base URL: `https://api.example.com`
- Resource: `/books`
- Content type: `application/json`

## 1. List all books

- **Method:** GET
- **Path:** `/books`
- **Description:** Returns all books.
- **Request body:** None
- **Success status:** `200 OK`

## 2. Get one book

- **Method:** GET
- **Path:** `/books/{id}`
- **Description:** Returns one book by its ID.
- **Request body:** None
- **Success status:** `200 OK`

Example: `GET /books/42`

## 3. Create a book

- **Method:** POST
- **Path:** `/books`
- **Description:** Creates a new book.
- **Success status:** `201 Created`

Example request body:

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "publishedYear": 1958
    }

## 4. Replace a book

- **Method:** PUT
- **Path:** `/books/{id}`
- **Description:** Replaces a book's editable details.
- **Success status:** `200 OK`

Example request body:

    {
      "title": "Things Fall Apart",
      "author": "Chinua Achebe",
      "publishedYear": 1958
    }

## 5. Delete a book

- **Method:** DELETE
- **Path:** `/books/{id}`
- **Description:** Deletes a book by its ID.
- **Request body:** None
- **Success status:** `204 No Content`

Example: `DELETE /books/42`

A 204 response has no response body.

## 6. List books by author

- **Method:** GET
- **Path:** `/books?author={authorName}`
- **Description:** Returns books matching the author query parameter.
- **Request body:** None
- **Success status:** `200 OK`

Example: `GET /books?author=Chinua%20Achebe`

## Error responses

### 400 Bad Request

Returned when request data is invalid, such as when a new book has no title.

Example response:

    {
      "error": "title is required"
    }

### 404 Not Found

Returned when the requested book ID does not exist.

Example request: `GET /books/99999`

Example response:

    {
      "error": "Book not found"
    }

## Design principles

- HTTP methods describe operations.
- Resource paths identify books.
- Path parameters identify individual books.
- Query parameters filter collections.
- The server validates incoming data.
- Responses use appropriate HTTP status codes.
