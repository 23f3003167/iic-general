# Activity Points Portal: Implementation Guide

## Purpose and scope

The Activity Points module lets a signed-in student submit proof after completing an eligible activity, view every submission and its review status, and view the points currently recorded for them.

This guide reflects the current portal configuration and Google Sheets integration. It describes **which activities may be submitted**; it does **not** define a point-value rulebook, because no point-to-activity calculation is present in the inspected source. Point values currently appear only as already-calculated values in the Activity Points score sheet.

## Student-facing journeys

1. **Submit activity** – student selects a category and the applicable activity path, enters the fields shown for that path, attaches proof where required, and submits.
2. **My submissions** – student sees timestamp, selected activity, proof link, `Pending` / `Approved` / other status, and reviewer reason.
3. **Activity-points summary** – student sees their stored score breakdown and totals.

Authentication is required for submission and score lookup. The system should take the student's email from the authenticated session, rather than trust an editable form field.

## Category model

| Code | Category | Student selects |
|---|---|---|
| CMA | Common Mandatory Activity Points | DBMS, PDSA, System Commands, or Cloud & DevOps |
| AM_IP | Additional Mandatory – Internship, Software Development | one of four Software Development courses |
| AM_ID | Additional Mandatory – Internship, Data Science | one of three Data Science courses |
| AM_EP | Additional Mandatory – Placement, Software Development | one of five Software Development courses |
| AM_ED | Additional Mandatory – Placement, Data Science | one of three Data Science courses |

Only one category path should be submitted in a single submission. A student may submit multiple separate submissions over time.

## Conditional activity catalogue

The portal should work as a decision tree: show an activity detail section only after all of its parent selections match.

### 1. Common Mandatory Activity Points (CMA)

| Course | Activity choices | Extra required data | Proof link |
|---|---|---|---|
| DBMS | DBMS Easy; DBMS Intermediate; DBMS Advanced | HackerRank profile URL | Required |
| PDSA | PDSA Easy; PDSA Medium; PDSA Hard | LeetCode profile URL | Required |
| System Commands | VM Tasks (1st series) | None | Required |
| Cloud & DevOps | Intro to Cloud Computing by Simplilearn; AWS Cloud Foundation Course; Any other Similar Certifications | None | Required |

### 2. Additional Mandatory – Internship, Software Development (AM_IP)

| Course | Detail collected | Proof link |
|---|---|---|
| Programming Concepts using Java | Java Tasks Easy or Java Tasks Medium; HackerRank profile URL | Required |
| Modern Application Development | Four project names and four corresponding GitHub repository URLs | Not currently required by the form |
| Software Engineer Intern Certificate | HackerRank profile URL | Not currently required by the form |
| Programming Workshop 1 | No additional activity choice | Required |

### 3. Additional Mandatory – Internship, Data Science (AM_ID)

| Course | Detail collected | Proof link |
|---|---|---|
| MLP – Kaggle Competition | Regression or Classification | Required |
| Machine Learning Basics Certificate | No additional activity choice | Required |
| Data Science Workshop 1 | No additional activity choice | Required |

### 4. Additional Mandatory – Placement, Software Development (AM_EP)

| Course | Detail collected | Proof link |
|---|---|---|
| Modern Application Development | Four project names and four corresponding GitHub repository URLs | Not currently required by the form |
| Software Engineer Certificate | HackerRank profile URL | Not currently required by the form |
| Cloud & DevOps | First select `Associate Certification`, then select Azure AZ204; AWS Solutions Architect – Associate; AWS Developer – Associate; AWS SysOps Administrator – Associate; or Google Associate Certifications | Required |
| System Commands | VM Tasks (2nd series), Bash Track on Exercism – Solved 30 problems, or Bash Track on Exercism – Reputation points over 100 | VM Tasks: required. Exercism choices: no proof link currently required, but the legacy form asks for a HackerRank URL (likely incorrect). |
| Programming Workshop 2 | No additional activity choice | Required |

### 5. Additional Mandatory – Placement, Data Science (AM_ED)

| Course | Activity choices | Proof link |
|---|---|---|
| Data Visualization Design | Microsoft Power BI Data Analyst Certification; Simplilearn Power BI Basics; Tableau Certification; Simplilearn Tableau Data Visualization; Simplilearn Data Analysis with Python | Required |
| AWS | AWS Academy Course – Data Engineering; Machine Learning Foundations; Machine Learning for Natural Language Processing | Required |
| Data Science Workshop 2 | No additional activity choice | Required |

## Form and validation requirements

- Collect `studentName` (required) and populate `studentEmailId` from login.
- Selection fields are required only when their parent branch is visible.
- Certificate/progress proof is a required Google Drive URL for every row marked “Required” above. Validate `https://drive.google.com/...`.
- Profile links must be valid URLs for their specified platform:
  - HackerRank: `https://(www.)?hackerrank.com/...`
  - LeetCode: `https://(www.)?leetcode.com/...`
  - Project repositories: `https://(www.)?github.com/...`
- A submission must preserve the full selection path as structured data, not just a display string.
- On creation set review status to `Pending`; reviewers can set status and a free-text reason.

## Recommended data model

Use a normalized submission record, plus a separate review record/audit trail. Do not model the response sheet's repeated columns directly.

```text
ActivitySubmission
  id, created_at, student_email, student_name
  category_code                 # CMA / AM_IP / AM_ID / AM_EP / AM_ED
  track                          # internship or placement, where applicable
  domain                         # software_development or data_science, where applicable
  course_code, course_label
  activity_code, activity_label  # nullable for certificate/workshop-only paths
  evidence_url                   # Google Drive proof URL, nullable only where listed above
  external_profile_url           # HackerRank/LeetCode URL, nullable
  projects[]                     # [{ name, github_url }], max 4
  status                         # Pending / Approved / Rejected
  reviewer_reason
  reviewed_by, reviewed_at
```

The activity catalogue itself should be admin-managed data with: stable code, label, parent conditions, evidence requirement, extra-field schema, active flag, and (once confirmed) point value/category allocation.

## Score summary to display

The current score sheet exposes these columns:

`Email, Name, Roll Number, Plan, Domain, NPPE Scores, DBMS, PDSA, SC, Cloud & DevOps, JAVA, SE, MAD, PGWS, MLT, DSWS1, MLP, ML Basics, DSWS2, DVD, DL, AWS, Total, CMA, Status, AM_IP, AM_ID, AM_EP, AM_ED`.

For the portal, show the identity fields, each activity score, `Total`, the category totals (`CMA`, `AM_IP`, `AM_ID`, `AM_EP`, `AM_ED`), and score status. The present integration is read-only: it looks up a student's row by authenticated email. Calculation and publishing of scores are outside the activity-submission code and need a separately agreed rule engine.

## Admin requirements

- Manage sections, fields, option lists, required flags, evidence requirement, and conditional visibility.
- Review each submission: open evidence, approve or reject, and record a reason.
- Maintain score rules separately from the form definition, then recalculate/publish the score summary after approval.
- Keep an immutable submission/review history; do not overwrite the student's original evidence or choices.

## Decisions required before implementation

1. Define the point value, caps, and category allocation for every activity. The existing code has no authoritative calculation rules.
2. Confirm whether MAD and Software Engineer certificate submissions should require Google Drive proof; the current form does not require it.
3. Correct the System Commands–Exercism evidence field: a HackerRank profile is not appropriate for an Exercism activity.
4. Confirm whether `DL` and `MLT` are score-only legacy columns or should have submit-able activities; no matching form path exists.
5. Decide whether one submission can include multiple activities. The current UI submits one selected path at a time, except MAD which collects four projects in one submission.

## Current legacy integration notes

The existing response sheet stores one very wide row per submission, with repeated column headings and a comma-separated `Activities` display value. This is fragile and should be treated as an import/export format only. The new portal should use stable field and activity codes, then derive display labels and reporting columns from them.
