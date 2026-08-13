# Evaluation Workflow

This guide describes the current flow for Behavioral, Presentation, and 1-on-1 evaluations.

## 1. Create and publish slots

An admin releases slots from the portal. The system creates time slots in the assessment's Google Sheet `Slot` tab, assigns an instructor, and records capacity (`seats taken` and `seats remaining`).

- **Behavioral and Presentation:** the admin also sets a booking window and the eligible student list. The booking window is saved in Apps Script and, when configured, mirrored to Firestore. Available slots are published to the Google Form as well as served to the portal.
- **1-on-1:** slots are released with a domain and instructor. Eligible students can view only available slots for their selected domain and plan.

## 2. Student booking

Students sign in to the portal and select an available slot.

1. The system checks that the booking window is open (for Behavioral and Presentation), the student's email is authorized, and the student does not already have a booking.
2. It validates that the selected slot still has capacity. A script lock prevents two students from taking the same final seat.
3. The booking is saved in `Booked Slots`, and the remaining capacity is reduced.
4. For consecutive slots belonging to the same evaluator, a Google Calendar event/Meet is created or updated for the evaluator and student.

For Behavioral and Presentation, form submissions are also reconciled into `Summary` by the summary refresh job. The refresh is scheduled every 15 minutes and avoids duplicate student-slot records. For 1-on-1, the booking is added to `Summary` immediately; the 15-minute refresh also imports or repairs older bookings. The 1-on-1 summary is sorted by session date and start time.

## 3. Evaluation

Evaluators use the portal to open their pending students. The portal reads the evaluator's assigned rows from the relevant `Summary` sheet and submits the result back to that same row.

| Assessment | Marks stored in Summary | Result |
| --- | --- | --- |
| Behavioral | Relevance (20), Clarity (30), Analytical/problem-solving (25), Grammar (25) | Total /100 and converted score out of 20, feedback, `Completed` |
| Presentation | Content (30), Slide composition & organisation (35), Presentation (35) | Total /100 and converted score out of 30, feedback, `Completed` |
| 1-on-1 | Programming, data-science, communication ratings, readiness, exceptional performance, recommended tasks/roles, detailed feedback | Feedback fields are saved and the row is marked `Completed` |

The dashboard's instructor statistics are derived from these Summary rows: allocated sessions, completed feedback, and absences.

## 4. Scores and student visibility

The student **Scores & Feedback** page reads the configured central Scores spreadsheet by the student's email. It also reads feedback from the dedicated feedback sheets (for example, `BA Feedback`, `Presentation Feedback`, and `1o1 Feedback`).

The admin **Publish Scores** tool currently supports bulk publishing only for **PPM**, **Aptitude**, and **Tech MCQ**. It accepts pasted email-and-score rows, writes them to the configured Level sheet, and removes duplicate entries.

Behavioral, Presentation, and 1-on-1 evaluation results are saved in their own Summary sheets; the present code does **not** automatically copy them into the central Scores spreadsheet. To show those result columns on the student Scores page, the summary results must be transferred to the corresponding central score/feedback sheet through the team's reporting process.

## At a glance

`Admin releases slots` → `Students book` → `Slot capacity and booking record update` → `Summary row is created` → `Evaluator submits feedback/marks` → `Summary is completed` → `Results are transferred/published to the central scores and feedback sheets` → `Student views them in the portal`
