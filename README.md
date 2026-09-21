# IIC Student Portal

The IIC Student Portal is an educational open-source project for building useful digital services for students, instructors, recruiters, and project administrators.

Students can learn by contributing to a real application built with React, TypeScript, Vite, Firebase, Google Apps Script integrations, automated tests, and collaborative GitHub workflows.

## Project objectives

The portal aims to provide a single place for student-focused workflows such as:

- Opportunities, activities, and engagement tracking
- Student forms and submissions
- Exams, evaluations, and feedback workflows
- One-to-one interactions and appointment-related processes
- Presentation and behavioral activities
- Support tickets and administrative workflows
- Clear, accessible interfaces for students and staff

The exact features may change as the project grows. Product decisions should be discussed in GitHub Issues or Discussions so contributors can understand the reasoning behind them.

## Learning objectives

By contributing to this project, students can practice:

- React component design and accessible UI development
- TypeScript, form validation, and client-side state management
- Firebase and secure data-access patterns
- API and Google Apps Script integration
- Testing, linting, debugging, and code review
- Git branches, pull requests, issue tracking, and releases
- Documentation, teamwork, and responsible open-source practices

## Before you contribute

1. Read [Guides/Open_Source_Collaboration_Guide.md](Guides/Open_Source_Collaboration_Guide.md).
2. Check the existing issues before starting work.
3. Comment on an issue or create one before implementing a new feature.
4. Ask a maintainer to confirm the approach for changes involving authentication, data storage, scoring, or integrations.
5. Use a separate branch or fork for every change.

The project lead and maintainers review changes before they are merged into `main`. Do not commit directly to `main`.

## Local setup

### Requirements

- Node.js and npm
- A GitHub account
- Access to the development configuration provided by the maintainers

### Install and run

```bash
npm ci
npm run dev
```

The development server normally runs on the port configured by Vite. Use the URL shown in the terminal.

### Check your changes

Run these commands before opening a pull request:

```bash
npm run lint
npm run test
npm run build
```

If a command fails, include the relevant error and what you tried in the pull request or issue.

## Contribution workflow

```text
Issue -> branch or fork -> implementation -> local checks -> pull request -> review -> merge
```

Use branch names such as:

```text
feature/short-description
fix/short-description
docs/short-description
```

A good pull request should include:

- The issue or problem it addresses
- A short explanation of the change
- Tests and checks that were run
- Screenshots for meaningful UI changes
- Any known limitations or follow-up work

Keep each pull request focused. Small, understandable changes are easier to review and better for learning.

## What to do

- Start with beginner-friendly issues labelled `good first issue` or `help wanted`.
- Ask questions when requirements are unclear.
- Reuse existing components, hooks, services, and project conventions.
- Write accessible UI with clear labels, keyboard support, and useful error messages.
- Add or update tests when behavior changes.
- Update documentation when setup or user behavior changes.
- Keep user-facing text respectful, clear, and inclusive.
- Review other students' pull requests constructively.
- Explain important technical decisions in issues or pull requests.
- Report security concerns privately to the maintainers.

## What not to do

- Do not commit passwords, API keys, Firebase credentials, service-account files, tokens, or `.env` files.
- Do not upload private student records, marks, feedback, recordings, photographs, email addresses, phone numbers, or personal documents.
- Do not publish private spreadsheets, database exports, production URLs, internal meeting notes, or staff-only instructions.
- Do not copy real data into tests, screenshots, examples, fixtures, or issue descriptions. Use synthetic data.
- Do not bypass authentication, authorization, validation, or review rules.
- Do not push directly to `main` or merge your own pull request.
- Do not make unrelated changes in the same pull request.
- Do not add a dependency without explaining its purpose, license, and maintenance considerations.
- Do not expose error logs or screenshots containing private information.
- Do not assume that data is public merely because the application can display it.

## Public and private information

Treat the following boundary as mandatory:

| Safe to discuss publicly | Keep private and share only through approved channels |
|---|---|
| General project goals and architecture | Credentials, tokens, and environment values |
| Sanitized code and documentation | Real student, staff, recruiter, or applicant data |
| Synthetic examples and test fixtures | Production database, sheets, storage, and deployment details |
| Reproducible bugs without personal data | Private evaluation results, recordings, and submissions |
| Public issues and pull requests | Internal emails, access links, and operational instructions |

If private information is accidentally committed, stop sharing it, inform a maintainer immediately, and rotate the affected credential. Removing the file in a later commit does not make an exposed secret safe.

## Project structure

- `src/` - React application source, pages, components, hooks, and services
- `src/components/ui/` - Shared UI primitives
- `src/lib/` - Firebase, API, validation, and business-service code
- `src/pages/` - Student and administrative page surfaces
- `appscripts/` - Google Apps Script source and sample integration material
- `chatbot/` - Chatbot-related integration code and documentation
- `public/` - Public static assets
- `Guides/` - Collaboration and project guidance

Some directories contain integration or operational code that should be reviewed by a maintainer before being changed or published. Never infer that a sample data file is safe to share without checking its contents.

## Review and leadership

The project lead has final approval responsibility for normal changes. The manager or another trusted maintainer reviews changes made by the project lead and sensitive changes involving authentication, data access, security, or deployment.

This keeps the project open for student learning while protecting users and the institution. See the [open-source collaboration guide](Guides/Open_Source_Collaboration_Guide.md) for the complete role, review, notification, and release policy.

## Privacy and security

This repository is for source code and learning material, not for storing confidential data. Use local environment variables for development configuration and request access through the maintainers. Never add real secrets to documentation, source code, screenshots, tests, or commit history.

Before the repository is made public, the maintainers must audit the files and Git history, confirm the license, and configure private security reporting and branch protection.

## License

The project license will be selected and added by the project leadership before public release. Do not assume that code, datasets, images, recordings, or third-party material may be redistributed merely because they are available inside the development environment.

## Getting help

For a bug, create a GitHub issue with steps to reproduce and sanitized examples. For a feature, describe the user problem and expected outcome. For a security or privacy concern, contact the maintainers privately instead of opening a public issue.

Please be patient and respectful. The purpose of this project is to build a useful portal and a healthy learning community together.
