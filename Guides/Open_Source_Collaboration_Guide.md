# Open-Source Collaboration Guide

This guide defines how to publish and manage the portal as an educational open-source project on GitHub. The goal is to let students learn through real contributions while keeping the project secure, reviewed, and directed by the host and manager.

## 1. Recommended ownership model

Use a **GitHub Organization** rather than keeping the repository under one personal account.

| Role | Recommended responsibility |
|---|---|
| You | Organization owner and project lead. Set the roadmap, approve student pull requests, manage releases, and make final decisions. |
| Manager | Organization owner or repository administrator/co-lead. Review important changes, help resolve escalations, and receive notifications. |
| Students | Contributors. Create issues, work on assigned branches, and submit pull requests. They should not push directly to `main`. |
| Reviewers/mentors | Optional maintainers. Review specific areas without receiving full administrative access. |

A GitHub repository does not have a special “co-host” role. The closest options are:

- **Organization owners:** full administrative access. Use this only for trusted leadership.
- **Repository maintainers:** can manage issues, pull requests, and repository settings allowed by their permission level.
- **Collaborators:** access is granted to an individual repository. This is suitable for a manager when an organization is not yet available.

### Recommended arrangement

- Create an organization owned by the institution or project team.
- Make yourself and your manager organization owners only if both of you need administrative control.
- Make yourself the project lead and required reviewer for the main codebase.
- Give students the lowest permission that lets them work effectively: normally `Read` access plus fork-and-pull-request workflow, or `Triage`/`Write` only for trusted student maintainers.
- Enable two-factor authentication for all owners and maintainers.

Do not share passwords or personal access tokens. Use individual GitHub accounts so every action has a clear audit trail.

## 2. Approval policy that matches your goal

GitHub cannot approve a pull request by the person who opened it. Therefore, “I approve every change myself” should be implemented as follows:

1. Students open pull requests into `main`.
2. You are automatically requested as a reviewer.
3. At least one approval from you is required before merging student changes.
4. The manager is notified for visibility and reviews high-risk or major changes.
5. Pull requests opened by you require approval from the manager or another trusted maintainer.
6. Direct pushes to `main` are blocked for everyone, including administrators where possible.

This gives you final approval authority without creating a false self-approval workflow.

## 3. Repository settings to configure

In **Settings > General**:

- Add a clear repository description and project website if available.
- Set the default branch to `main`.
- Disable direct creation of branches from untrusted workflows where appropriate.
- Disable force pushes and branch deletion on protected branches.
- Enable vulnerability alerts, Dependabot security updates, and secret scanning when available for the repository plan.
- Add a `LICENSE` file before accepting external contributions.

In **Settings > Collaborators and teams**:

- Create teams such as `project-leads`, `maintainers`, and `student-contributors`.
- Give `project-leads` administrative access only when required.
- Give `maintainers` maintain access, not owner access, unless they need organization-level administration.
- Give student teams read or triage access initially.

In **Settings > Actions > General**:

- Allow workflows from trusted sources only.
- Review third-party actions before enabling them.
- Restrict secrets to the environments and workflows that need them.
- Never print environment variables or service credentials in workflow logs.

## 4. Protect the `main` branch

Create a branch protection rule or repository ruleset for `main` with these settings:

- Require a pull request before merging.
- Require at least one approving review.
- Require approval from Code Owners.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging when practical.
- Block force pushes and branch deletion.
- Restrict who can push to `main`.
- Do not allow bypassing these rules for routine work. Keep any administrator bypass for emergency recovery only.

Start with one required approval from you. For sensitive areas such as authentication, Firebase rules, Apps Script integrations, and deployment configuration, require a second approval from the manager or a designated maintainer.

## 5. Use CODEOWNERS for automatic review requests

Add `.github/CODEOWNERS` with a structure similar to this:

```text
# Project lead reviews the application by default
* @YOUR_GITHUB_USERNAME

# Manager reviews security, data, and deployment changes
/src/lib/firebase.ts @MANAGER_GITHUB_USERNAME
/firestore.rules @MANAGER_GITHUB_USERNAME
/appscripts/ @MANAGER_GITHUB_USERNAME
/.github/ @MANAGER_GITHUB_USERNAME
```

Replace the placeholders with real usernames or, preferably, GitHub team names such as `@your-org/project-leads`. Check the paths before using them if the repository structure changes.

CODEOWNERS only requests reviews. Branch protection must also require Code Owner approval for it to become a merge requirement.

## 6. Contribution workflow for students

Use a simple feature-branch workflow:

```text
Issue -> fork or branch -> implementation -> pull request -> checks -> review -> merge
```

### Student workflow

1. Read `README.md`, `CONTRIBUTING.md`, and the Code of Conduct.
2. Choose an issue labelled `good first issue`, `help wanted`, or `learning`.
3. Comment on the issue before starting so two students do not duplicate work.
4. Create a branch using a predictable name:

```text
feature/short-description
fix/short-description
docs/short-description
```

5. Make the smallest useful change.
6. Run the relevant checks locally:

```bash
npm ci
npm run lint
npm run test
npm run build
```

7. Open a pull request using the pull-request template.
8. Explain what changed, how it was tested, and any screenshots or risks.
9. Respond to review comments and keep the branch updated.
10. A maintainer merges the pull request after all checks and approvals pass.

Keep pull requests focused. A student should not combine unrelated UI redesign, dependency upgrades, and database changes in one pull request.

## 7. Notification plan for you and your manager

Use GitHub's built-in review and notification features instead of informal forwarding:

- Add yourself as a required Code Owner for normal source changes.
- Add the manager as a Code Owner for security, data, deployment, and major architecture changes.
- Use **Request review** on every pull request that needs the manager's attention.
- Subscribe the manager to repository activity or the relevant team, rather than sending manual notifications for every low-risk change.
- Use labels such as `needs-project-lead-review`, `needs-manager-review`, `security`, and `breaking-change`.
- Create a weekly GitHub Project view for open pull requests, blocked issues, and releases.
- Record important decisions in issues or Discussions so students can learn from them and future maintainers can find the reasoning.

A practical notification rule is:

| Change type | Your review | Manager notification/review |
|---|---:|---:|
| Documentation, tests, small UI fix | Required | Notification; review optional |
| Business logic or Firebase integration | Required | Required review |
| Authentication, Firestore rules, secrets, deployment | Required | Required review |
| Dependency upgrade with security impact | Required | Required review |
| Pull request authored by you | Manager/maintainer review | Required |

## 8. Files to add before opening the repository

Create these project-governance files before inviting students:

- `CONTRIBUTING.md` - setup, branch naming, testing, pull requests, and review rules.
- `CODE_OF_CONDUCT.md` - respectful and inclusive collaboration standards.
- `SECURITY.md` - how to report vulnerabilities privately.
- `LICENSE` - the open-source permissions and conditions selected by the institution.
- `.github/CODEOWNERS` - automatic review ownership.
- `.github/pull_request_template.md` - consistent pull-request information.
- `.github/ISSUE_TEMPLATE/bug_report.md` - reproducible bug reports.
- `.github/ISSUE_TEMPLATE/feature_request.md` - structured feature proposals.
- `.env.example` - variable names only, with no real keys or tokens.

Review the existing `.env`, Firebase configuration, Apps Script deployments, CSV files, and repository history before publishing. Remove credentials, private student data, personal email addresses, service-account files, and production-only URLs. Rotating a secret after it has been committed is necessary; deleting the file alone is not sufficient.

## 9. Choose the license carefully

Discuss licensing with the institution and manager before publishing. Common choices include:

- **MIT:** simple and permissive; others can reuse and modify the code with attribution.
- **Apache-2.0:** permissive and includes an explicit patent license.
- **GPL-3.0:** derivative distributions must generally remain under the same license.

Do not copy code, images, student submissions, datasets, or dependencies into the repository unless their licenses permit redistribution. The portal's source-code license does not automatically license student data or third-party content.

## 10. Suggested review and release policy

### Pull-request merge checklist

- The change is linked to an issue or an explicit project decision.
- The code follows the existing TypeScript and React patterns.
- Lint, tests, and production build pass.
- No secrets or private data were added.
- Required reviewers approved the change.
- Documentation is updated when behavior or setup changes.
- The pull request title and description explain the user impact.

### Release policy

- Merge completed work into `main` only through reviewed pull requests.
- Use tags or GitHub Releases for meaningful versions.
- Keep a short changelog for user-visible changes.
- Have the project lead publish normal releases.
- Have both the project lead and manager review releases that change authentication, data handling, scoring, or deployment.
- Keep rollback instructions documented before deploying a significant release.

## 11. A practical rollout plan

### Phase 1: Prepare

1. Decide whether the institution or project team should own the GitHub organization.
2. Agree on the license, data policy, and two-person leadership model.
3. Audit the complete Git history for secrets and private data.
4. Add the governance files listed above.

### Phase 2: Configure

1. Create teams and assign the project lead and manager.
2. Protect `main` and configure required status checks.
3. Add CODEOWNERS and review-request labels.
4. Add CI for lint, tests, and build.
5. Create a small set of beginner-friendly issues.

### Phase 3: Pilot

1. Invite a small group of students first.
2. Ask each student to complete one documentation or test issue.
3. Review whether the approval and notification rules are practical.
4. Adjust permissions only after observing the workflow for one or two weeks.

### Phase 4: Open collaboration

1. Publish contribution instructions and a project roadmap.
2. Hold a short recurring maintainer meeting.
3. Triage issues regularly and close stale requests politely.
4. Recognize contributions through release notes or a contributors page.
5. Review permissions, secrets, dependencies, and inactive accounts every quarter.

## 12. Recommended operating principle

Keep the project open to contributions but conservative about merging. Students should be free to ask questions, propose improvements, and experiment in branches or forks. Production code, data rules, authentication, and deployments should move only through visible pull requests, automated checks, and approval from the appropriate project lead or manager.

The most effective structure for this portal is therefore:

```text
Students propose and implement
            |
            v
Automated checks + peer discussion
            |
            v
You provide required project-lead approval
            |
            v
Manager reviews sensitive changes and your pull requests
            |
            v
Maintainer merges and documents the decision
```
