# IIC Training Progress Cards

This is a container-bound Google Apps Script for the `Training Database - 2026` spreadsheet. It creates a PDF when a student's Level 3 status is `Pass`, emails the training feedback form, and emails the report link after the form response arrives.

## Included files

- `Code.gs` contains spreadsheet menus, triggers, report generation, and email workflows.
- `Config.gs` contains the form URL, output headers, embedded 128px derivative of `logo.png`, owner, team viewers, and sender display name.
- `feedback-form-question-suggestions.md` contains proposed additions for manual entry in Google Forms. Apps Script does not edit the form.
- `progress-card-template.pdf` is the visual reference for the report header and footer.

## Setup

1. Open the `Training Database - 2026` spreadsheet while signed in as `iic@study.iitm.ac.in`.
2. Open **Extensions > Apps Script** and add the contents of `Code.gs` and `Config.gs` as separate script files.
3. Save, return to the spreadsheet, and reload it. Confirm the Level 3 headers in columns S, T, and U are `Progress Card Link`, `Progress Card Status`, and `Feedback Form Email Status`. The setup function fills these headers only when the cells are blank; it will stop rather than overwrite existing labels.
4. From the **Progress Cards** menu, choose **Set up progress card triggers**. On first run, paste the feedback response spreadsheet URL supplied by the team. The configured response tab gid is `957525577`.
5. Accept the requested Sheets, Drive, and email permissions. Setup installs only a form-submit trigger for the response spreadsheet. It also removes any older Level 3 edit trigger. The remaining trigger runs as the account that authorized setup.
6. Confirm the IIC account has edit access to all training and feedback sheets and can grant Viewer access to the IIC team and student accounts.

## Workflow

- Level 3 edits do not create reports or send emails automatically. Use **Progress Cards > Generate reports and send forms to eligible students** to process rows with `Pass` in column L and a blank form-email status in U. It generates a team-only PDF, sends the feedback form, and records `FORM SENT` after successful delivery. The student is not granted PDF access at this point.
- The form response is matched using the `Student Email ID` column. After a matching response, the script refreshes the PDF from the assessment feedback sheets, grants the student Viewer access, emails the report, and writes `REPORT SENT` in T. Form answers are used to verify submission, not displayed in the card.
- Setup reconciles existing PDF permissions too: students without a matching response have Viewer access removed; students with a response are granted access.
- The PDF includes the IIC favicon, requested earned/max scores, level outcomes, expanded attempt labels, and feedback from CSM, Behavioral, Presentation, and 1-on-1 sheets. The four CSM components are shown separately, with attempts counted independently for each component. Level Results, the combined CSM row, training-form responses, and CMA are omitted.
- **Send feedback form to selected row** sends or resends the form email for a selected passed student, for testing or recovery.
- Before the first bulk run, mark previously emailed rows `FORM SENT` in U to avoid sending duplicate feedback requests.
- **Send progress card to selected row** sends a not-yet-sent card when that student has a matching form response. Use **Resend latest card for selected row** for a card already marked `REPORT SENT`.
- **Send progress cards for submitted forms** sends cards to matching passed students with a form response and no `REPORT SENT` in T.
- **Progress Cards > Regenerate card for selected row** creates a fresh PDF and updates S without sending another email.
- **Progress Cards > Regenerate and email updated card** refreshes the PDF and emails the new link, but only when T already says `REPORT SENT`.
- **Progress Cards > Resend latest card for selected row** resends the link only when T already says `REPORT SENT`.
- Group membership remains a manual process.
- Add suggested feedback questions manually from `feedback-form-question-suggestions.md` if useful for program evaluation. No Forms API calls are made, and these responses are not shown in the progress card.

## Account and Drive behavior

Authorize setup as `iic@study.iitm.ac.in`. The installable triggers and `MailApp` then run as IIC, so email is sent from IIC with the display name `Industry Interaction Cell POD`, and newly created PDFs are IIC-owned. The script grants Viewer access to the IIC team at creation; student access is added only after a matching form response. On setup, existing card links are reconciled too: access is granted to submitters and removed from non-submitters. Verify the first generated file's owner and sharing in Drive before relying on automatic processing.

A public web app deployment is not required for this spreadsheet-menu and trigger workflow. Level 3 processing is manual from the menu; only feedback-form submission is handled by an installable trigger. The feedback-request email says form completion is mandatory to receive the card and explains GSpace eligibility.

## First-run test

Use a test row or an internally controlled student account. Confirm the PDF layout, owner, IIC team access, student access only after form submission, request email, response matching, report email, and T/U statuses. Also verify the actual form response header is exactly `Student Email ID` and that the response tab gid matches the configured value before enabling this for live student records.