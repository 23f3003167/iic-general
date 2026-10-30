# Exam submission sync setup

Student submissions are written once to the `examSubmissions` Firestore collection. The Apps Script trigger below calculates MCQ scores, records the result with the existing exam spreadsheet code, and deletes the Firestore document only after the sheet write succeeds. Failed syncs remain pending and are retried on the next run.

## One-time setup

1. Deploy the updated `firestore.rules` to the Firebase project used by the student portal:

   ```sh
   firebase deploy --only firestore:rules
   ```

2. Add `Sync.gs` to the existing Exams Apps Script project. Merge the OAuth scopes in `appsscript.json` into that project's manifest if it already has one; do not replace its existing manifest settings.

3. Enable the Google Cloud Firestore API for the Firebase project. In Google Cloud IAM, grant the Google account that owns the Apps Script trigger the **Cloud Datastore User** role (`roles/datastore.user`) on that project. This lets the script use the Firestore REST API with its owner-authorized OAuth token; it does not use Cloud Functions.

4. In Apps Script project settings, add the script property `FIREBASE_PROJECT_ID` with the Firebase project's ID. It must match `VITE_FIREBASE_PROJECT_ID` in the portal.

5. Run `setupExamSubmissionSyncTrigger` once from the Apps Script editor and accept the requested permissions. It installs a one-minute trigger for `syncPendingExamSubmissions`.

6. Submit a test attempt and verify it appears in the `Attempted` sheet. Then confirm the corresponding `examSubmissions` document has been deleted. Check Apps Script **Executions** if a document remains pending.

The trigger processes up to 10 pending submissions per run. A submission document is retained when a spreadsheet write fails, so the next run can retry it. Reprocessing uses the same attempt ID, preventing a retry from adding a second row for that attempt.