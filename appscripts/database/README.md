# Database Extractor - Google Apps Script Setup

This Google Apps Script extracts student email IDs by pending activity categories from a Google Spreadsheet and makes them available via a web app API for the admin portal.

## Features

- Extracts email IDs from Level 1, Level 2, and Level 3 sheets
- Groups emails by pending activity categories
- Provides JSON API endpoints for each level
- Web app deployment for easy integration

## Spreadsheet Structure

The script expects a Google Spreadsheet with the following structure:

### Sheet Names
- `Level 1`
- `Level 2`
- `Level 3`

### Column Mappings

**Level 1 Sheet:**
- Column C (index 2): Email IDs
- Column S (index 18): Level 1 (Pass/Fail) - Contains pending status like "Pending: PPM, CSM"

**Level 2 Sheet:**
- Column C (index 2): Email IDs
- Column M (index 12): Level 2 (Pass/Fail) - Contains pending status like "Pending: BA"

**Level 3 Sheet:**
- Column C (index 2): Email IDs
- Column L (index 11): Level 3 (Pass/Fail) - Contains pending status like "Pending: AI Mock, 1-on-1"

## Setup Instructions

### 1. Create Google Apps Script

1. Go to [script.google.com](https://script.google.com/)
2. Click on "New project"
3. Delete any existing code in the editor
4. Copy the contents of `DatabaseExtractor.gs` and paste it into the editor

### 2. Configure Spreadsheet ID

In the `DatabaseExtractor.gs` file, replace the placeholder:

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

With your actual Google Spreadsheet ID. You can find it in the URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

### 3. Deploy as Web App

1. Click on "Deploy" in the top right corner
2. Select "New deployment"
3. Click the gear icon ⚙️ next to "Select type" and choose "Web app"
4. Fill in the deployment details:
   - **Description**: "Database Extractor API"
   - **Execute as**: "Me" (your email)
   - **Who has access**: "Anyone" (important for the admin portal to access it)
5. Click "Deploy"
6. Authorize the script when prompted (grant permissions to access your spreadsheet)
7. Copy the **Web app URL** that appears after deployment

### 4. Update Environment Variables

Add the web app URL to your `.env` file:

```env
VITE_DB_APPS_SCRIPT_WEB_APP_URL=YOUR_WEB_APP_URL_HERE
```

Replace `YOUR_WEB_APP_URL_HERE` with the actual web app URL you copied in step 3.

**Note**: The app uses CORS proxies to bypass Google Apps Script CORS restrictions. Multiple proxies are tried automatically for reliability.

## API Endpoints

Once deployed, the web app provides the following endpoints:

### Get All Data
```
YOUR_WEB_APP_URL?action=all
```
Returns data for all levels in a single response.

### Get Level 1 Data
```
YOUR_WEB_APP_URL?action=level1
```
Returns Level 1 pending categories and email IDs.

### Get Level 2 Data
```
YOUR_WEB_APP_URL?action=level2
```
Returns Level 2 pending categories and email IDs.

### Get Level 3 Data
```
YOUR_WEB_APP_URL?action=level3
```
Returns Level 3 pending categories and email IDs.

### Search Student by Email Across All Levels
```
YOUR_WEB_APP_URL?action=searchStudent&email=student@ds.study.iitm.ac.in
```
Returns matched row details from Level 1, Level 2, and Level 3 sheets (including attempt columns).

## Response Format

```json
{
  "level": "Level 1",
  "categories": {
    "PPM, CSM": [
      "student1@ds.study.iitm.ac.in",
      "student2@ds.study.iitm.ac.in"
    ],
    "CSM": [
      "student3@ds.study.iitm.ac.in"
    ]
  }
}
```

## Testing the Script

You can test the script directly in the Apps Script editor:

1. Select the function `testScript` from the function dropdown
2. Click "Run"
3. Check the "Execution log" to see the output

## Troubleshooting

### "Script function not found" error
- Make sure you've deployed the script as a web app (not just saved)
- Check that the web app URL is correct in `DatabaseManagement.tsx`

### "Authorization required" error
- Make sure you selected "Anyone" for "Who has access" when deploying
- Re-deploy the web app if you changed permissions

### "Sheet not found" error
- Verify that your spreadsheet has sheets named exactly "Level 1", "Level 2", and "Level 3"
- Check that the spreadsheet ID is correct

### No data returned
- Verify that your data has "Pending:" in the Pass/Fail columns
- Check that email IDs are in column C (index 2)
- Use the `testScript` function to debug

### CORS errors in browser
Google Apps Script web apps have strict CORS restrictions. The current implementation tries multiple public CORS proxies automatically:

1. **api.allorigins.win** - Primary proxy
2. **corsproxy.io** - Fallback proxy

If both proxies fail, the app will show an error. This can happen if:
- The proxy services are temporarily down
- Your network blocks these proxies
- The Apps Script URL is incorrect

**Alternative Solutions if Proxies Don't Work**:

1. **Use a different CORS proxy**: Try other public CORS proxies like `cors-anywhere.herokuapp.com` (requires temporary activation)

2. **Use a backend service**: Deploy a simple backend service (Node.js, Python, etc.) that calls the Apps Script server-side and forwards the response to your frontend

3. **Use Google Apps Script as a standalone API**: Access the Apps Script URL directly in a browser or use tools like Postman to verify it works, then consider the proxy issue

## Security Notes

- The web app is deployed with "Anyone" access, which means anyone with the URL can access it
- Consider adding authentication to the web app if you need additional security
- Never commit the actual spreadsheet ID or web app URL to public repositories
- Use environment variables or configuration files for sensitive data

## Maintenance

- If you add new sheets or change column mappings, update the `DatabaseExtractor.gs` file
- After making changes, redeploy the web app (create a new deployment version)
- Test the endpoints after any changes to ensure they work correctly

## Support

For issues or questions:
1. Check the Execution log in Apps Script editor
2. Verify spreadsheet structure matches the requirements
3. Ensure the web app is properly deployed with correct permissions
