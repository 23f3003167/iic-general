# Evaluators Tab Setup Guide

## Overview
The Evaluators tab allows instructors to review pending evaluations and submit scores/feedback that write to the Summary subsheet in Google Sheets.

## Architecture

### Frontend
- **Component**: `src/pages/admin/EvaluatorsManagement.tsx`
- **Service**: `src/lib/evaluatorsService.ts`
- **Types**: `BehavioralEvaluation` in `src/types/index.ts`

### Backend
The evaluators feature uses Google Apps Script to:
1. Fetch pending evaluations filtered by instructor name
2. Submit evaluation scores and feedback
3. Update the Summary sheet with calculated totals

## Setup Steps

### Step 1: Deploy Evaluators Web App in Google Apps Script

1. **Open your Google Apps Script project** (the same one with behavioral module)

2. **Create a new file** named `Api.gs` in a new folder folder called "evaluators":
   - Copy the content from `appscripts/evaluators/Api.gs`

3. **Deploy as Web App**:
   - Click "Deploy" → "New Deployment"
   - Type: Select "Web app"
   - Execute as: Your email/service account
   - Who has access: "Anyone" (IMPORTANT for CORS)
   - Click "Deploy"
   - Copy the deployment URL (looks like: `https://script.google.com/macros/d/{ID}/usercontent/exec`)

### Step 2: Configure Environment Variables

Update your `.env` file with the evaluators endpoint:

```env
# Behavioral/Evaluators Apps Script endpoint (can be the same URL if you want)
VITE_EVALUATORS_APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/d/{ID}/usercontent/exec
VITE_EVALUATORS_APPS_SCRIPT_API_TOKEN=your_api_token_here
```

### Step 3: Update Frontend Service (if using separate endpoint)

If you deployed the evaluators API at a different URL than the behavioral endpoint, update `src/lib/evaluatorsService.ts`:

Change:
```typescript
const BEHAVIORAL_WEB_APP_URL = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL;
const BEHAVIORAL_API_TOKEN = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN;
```

To:
```typescript
const EVALUATORS_WEB_APP_URL = import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_WEB_APP_URL;
const EVALUATORS_API_TOKEN = import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_API_TOKEN;
```

And update references in the function:
```typescript
async function callEvaluatorsAppsScript<T>(payload: any): Promise<T> {
  if (!EVALUATORS_WEB_APP_URL) {
    throw new Error('Evaluators Apps Script URL not configured');
  }
  // ... use EVALUATORS_WEB_APP_URL and EVALUATORS_API_TOKEN
}
```

### Step 4: Set API Token in Apps Script (Optional but Recommended)

1. In Apps Script editor, go to **Project Settings** (gear icon)
2. Enable **Show "appsscript.json" manifest file**
3. Go back to editor and click on `appsscript.json`
4. Set Script Properties:

```json
{
  "timeZone": "Asia/Kolkata",
  "externalRequestOrigins": ["*"],
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.properties"
  ]
}
```

Then in the Apps Script UI:
- Click "Project Settings"
- Under "Script Properties", add:
  - Key: `API_TOKEN`
  - Value: `your_secure_token_here` (same as in `.env` file)

### Step 5: Verify Sheet Structure

The Evaluators feature expects these columns in your **Summary** sheet:

| Column | Description |
|--------|-------------|
| ID | Unique identifier for each evaluation |
| Instructor | Instructor name (used for filtering) |
| Slot | Slot/Session details |
| Name | Student name |
| Email | Student email |
| Evaluation Status | "Pending" or "Completed" |
| Relevance (20) | Score 0-20 |
| Clarity of Communication (30) | Score 0-30 |
| Analytical/Problem-Solving Skills (25) | Score 0-25 |
| Grammar (25) | Score 0-25 |
| total | Auto-calculated (A+B+C+D) |
| Out of 20 | Auto-calculated (total/100*20) |
| Feedback | Evaluator's feedback text |

**Note**: Columns A-F (ID through Evaluation Status) are already in the sheet from CSV import.

### Step 6: Build and Deploy Frontend

```bash
npm run build
firebase deploy
```

### Step 7: Test the Feature

1. Navigate to **Admin Dashboard → Evaluators tab**
2. Select your name from the dropdown
3. You should see pending evaluations (rows with `Evaluation Status = "Pending"`)
4. Click "Evaluate" button
5. Fill in scores for:
   - Relevance (0-20)
   - Clarity of Communication (0-30)
   - Analytical/Problem-Solving Skills (0-25)
   - Grammar (0-25)
   - Feedback (optional)
6. Click "Submit Evaluation"
7. Check the Google Sheet - row should now show the scores and status should be "Completed"

## How It Works

### Data Flow

```
Evaluators Tab UI
    ↓
Web Form (scores + feedback)
    ↓
evaluatorsService.submitEvaluation()
    ↓
POST to Apps Script endpoint
    ↓
Api.gs: submitEvaluation_() 
    ↓
Find row by ID in Summary sheet
Update columns with scores
Calculate total and out of 20
Update status to "Completed"
    ↓
Response back to UI
```

### Filtering Workflow

1. User selects their name in the Evaluators tab
2. Frontend calls `getPendingEvaluations(instructorName)`
3. Api.gs queries Summary sheet
4. Returns only rows where:
   - Instructor name matches selected name
   - Evaluation Status = "Pending"
5. Displays in UI with update button

## Linking the Subsheet with Web App

The connection is established through:

1. **Sheet ID**: Apps Script uses `SpreadsheetApp.getActiveSpreadsheet()` - this gets the spreadsheet where the Apps Script project is bound
2. **Subsheet Name**: The code references `getSheetByName('Summary')` - make sure this sheet exists in your spreadsheet
3. **Column Mapping**: The code uses header row to find columns dynamically, so column order doesn't matter as long as headers match

### Ensure Your Setup:
- ✅ Apps Script project is bound to the Google Sheet containing the Summary subsheet
- ✅ Summary subsheet has all required columns with exact header names
- ✅ Pending rows have `Evaluation Status = "Pending"`
- ✅ Apps Script is deployed as a web app accessible from your React app

## Troubleshooting

### "Summary sheet not found"
- Verify the sheet is named exactly "Summary"
- Make sure Apps Script project is bound to the correct spreadsheet

### "Required columns not found"
- Check column headers match exactly (case-sensitive):
  - `Instructor`, `Evaluation Status`, `ID`, `Slot`, `Name`, `Email`
  - `Relevance (20)`, `Clarity of Communication (30)`, `Analytical/Problem-Solving Skills (25)`, `Grammar (25)`

### "Unauthorized - Invalid API token"
- If you set an API token in Script Properties, ensure `.env` has the same token
- Or remove the token temporarily for testing (Api.gs skips validation if none configured)

### No pending evaluations showing
- Verify rows in Summary sheet have `Evaluation Status = "Pending"`
- Check that `Instructor` column matches exactly the selected instructor name
- Check sheet data is not empty (rows must start at row 2, row 1 is headers)

### Scores not updating in sheet
- Check browser console for error messages
- Verify column indices are correct (no missing columns shifted the layout)
- Ensure you have edit permissions on the Google Sheet
- Check Apps Script logs: Extensions → Apps Script → Logs

## API Endpoints

### getPendingEvaluations
```json
Request:
{
  "action": "getPendingEvaluations",
  "instructorName": "Abinaya"
}

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "instructor": "Abinaya",
      "slot": "20/01/2026 Tuesday 05:00 PM - 05:10 PM",
      "name": "Student Name",
      "email": "student@example.com",
      "status": "Pending",
      "rowIndex": 2
    }
  ]
}
```

### submitEvaluation
```json
Request:
{
  "action": "submitEvaluation",
  "id": "uuid-123",
  "relevance": 18,
  "clarity": 27,
  "analyticalSkills": 23,
  "grammar": 24,
  "feedback": "Great attempt with STAR structure..."
}

Response:
{
  "success": true,
  "message": "Evaluation submitted successfully",
  "data": {
    "rowIndex": 2,
    "total": 92,
    "outOf20": 18.4
  }
}
```

### getUniqueInstructors
```json
Request:
{
  "action": "getUniqueInstructors"
}

Response:
{
  "success": true,
  "data": ["Abinaya", "Anna", "Gayathri", "Ragendu", "Teza"]
}
```

## Future Enhancements

- [ ] Bulk evaluation submission
- [ ] Download evaluation history as PDF
- [ ] Performance stats/dashboard per instructor
- [ ] Evaluation templates
- [ ] Student notification on evaluation completion
- [ ] Multiple evaluation rounds support
