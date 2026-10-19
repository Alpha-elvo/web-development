# School Database Design

## 1. Students table

The students table stores each student's unique ID, name and email.
The student ID is the primary key, and the email is NOT NULL and
UNIQUE so that two students cannot share the same email address.

## 2. Courses table

The courses table stores each course's unique ID, name and description.
The course ID is the primary key. The course name is also required
and UNIQUE to avoid duplicate course records.

## 3. Enrolments table

The enrolments table records which student takes which course and
the student's grade. It contains foreign keys referencing students
and courses. Both foreign keys are NOT NULL. The combined primary
key (student_id, course_id) prevents the same student from enrolling
on the same course more than once.

## Relationships

Students and enrolments have a one-to-many relationship: one student
may have multiple enrolment records, while each enrolment belongs to
one student.

Courses and enrolments also have a one-to-many relationship: one
course may have multiple enrolment records, while each enrolment
belongs to one course.

Students and courses therefore have a many-to-many relationship.
A student can take several courses, and each course can have several
students. The enrolments join table resolves this relationship by
storing student-course pairs and the grade for each pair.

## Index choice

I added an index on enrolments(course_id). It helps the database
find enrolments for a particular course, such as when listing all
students on a course or counting students per course. The index
uses extra storage and adds some overhead to inserts and updates.

## SQL or NoSQL?

I would choose a relational SQL database such as SQLite for this
school system. Students, courses and enrolments have clear
relationships, and foreign keys help preserve referential integrity.
A student-course pair must be unique, and grades belong to a specific
enrolment. SQL supports these constraints, joins, grouping and
transactions directly. A NoSQL database could work, but it would
require additional design to enforce these relational rules reliably.
