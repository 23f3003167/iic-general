# Deployment & Testing Checklist

## Pre-Deployment Testing

### 1. Local Testing
```bash
# Start development server
npm run dev

# The app should run on http://localhost:5173
```

### 2. Test Public Pages
- [ ] Home page (`/`) - loads forms from Firestore
- [ ] Announcements (`/announcements`) - displays announcements
- [ ] FAQs (`/faqs`) - shows FAQs in accordion
- [ ] Documents (`/documents`) - displays document cards

### 3. Test Admin Panel
- [ ] Login page (`/admin`) - Google Sign-In button visible
- [ ] Sign in with Google using admin email
- [ ] Dashboard (`/admin/dashboard`) - shows statistics
- [ ] Forms Management (`/admin/forms`) - CRUD operations
  - [ ] Create new form
  - [ ] Edit existing form
  - [ ] Delete form
  - [ ] Verify form appears on home page
- [ ] Announcements (`/admin/announcements`) - CRUD operations
  - [ ] Create new announcement
  - [ ] Edit announcement
  - [ ] Toggle important flag
  - [ ] Delete announcement
  - [ ] Verify on announcements page
- [ ] FAQs (`/admin/faqs`) - CRUD operations
  - [ ] Create new FAQ
  - [ ] Edit FAQ
  - [ ] Delete FAQ
  - [ ] Verify on FAQs page
- [ ] Documents (`/admin/documents`) - CRUD operations
  - [ ] Create new document with different types (PDF/Drive/External)
  - [ ] Edit document
  - [ ] Delete document
  - [ ] Verify on documents page

### 4. Test Security
- [ ] Try accessing `/admin/dashboard` without logging in - should redirect to `/admin`
- [ ] Log out and verify redirect
- [ ] Try accessing with non-admin email - should show "Unauthorized" message
- [ ] Verify admin allowlist is working

## Firestore Setup

### 1. Create Collections
In Firebase Console → Firestore Database, create the following collections:

**forms** - Documents with:
```json
{
  "title": "string",
  "category": "string (Academics, Internships, Placements, Scholarships, Competitions, Other)",
  "description": "string",
  "status": "string (Open, Closed, Coming Soon)",
  "startDate": "string (YYYY-MM-DD)",
  "endDate": "string (YYYY-MM-DD)",
  "url": "string (URL to Google Form)"
}
```

**announcements** - Documents with:
```json
{
  "title": "string",
  "content": "string",
  "date": "string (ISO format)",
  "important": "boolean"
}
```

**faqs** - Documents with:
```json
{
  "question": "string",
  "answer": "string"
}
```

**documents** - Documents with:
```json
{
  "title": "string",
  "description": "string",
  "url": "string (URL to document/drive/link)",
  "type": "string (PDF, Drive, External)"
}
```

**admins** → **allowed** Document with:
```json
{
  "emails": ["admin1@gmail.com", "admin2@gmail.com"]
}
```

### 2. Firestore Security Rules

Replace Firestore rules with:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      let adminEmails = get(/databases/$(database)/documents/admins/allowed).data.emails;
      return request.auth != null && request.auth.token.email.lower() in adminEmails;
    }
    
    // Admin collection - only read by admins
    match /admins/allowed {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    // All other collections - read for everyone, write for admins only
    match /{collection}/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

## Build & Deploy

### 1. Build the Project
```bash
npm run build
```

Check for any build errors. The output should be in the `dist/` folder.

### 2. Deploy to Firebase
```bash
firebase deploy --only hosting
```

Or deploy with specific targets:
```bash
firebase deploy --only hosting:iic-general
```

### 3. Verify Deployment
- [ ] Visit https://iic-general.web.app
- [ ] Test all public pages load correctly
- [ ] Test admin login and CRUD operations

## Adding Admin Users

To give someone admin access:

1. Ask them to sign in once with Google at `/admin`
2. They should see "Unauthorized" message
3. Go to Firebase Console → Firestore Database
4. Open `admins` → `allowed` document
5. Add their email to the `emails` array:
   ```json
   {
     "emails": ["existing@gmail.com", "newemail@gmail.com"]
   }
   ```
6. They can now log in

## Troubleshooting

### Issue: "Missing or insufficient permissions"
- Check Firestore security rules are applied correctly
- Verify `admins/allowed` collection exists
- Ensure user email is in admin allowlist (lowercase)

### Issue: Google Sign-In not working
- Verify authorized domains in Firebase Authentication
- Should include: `iic-general.web.app` and `iic-general.firebaseapp.com`
- Check OAuth consent screen is configured

### Issue: Data not loading on public pages
- Check Firestore collections exist with correct names
- Verify documents are created in Firestore (not using mock data)
- Check browser console for errors

### Issue: Admin page shows blank after login
- Check user email is in `admins/allowed` document
- Verify email is lowercase
- Try refreshing the page
- Check browser console for errors

## Environment Variables

Verify `.env` file (if needed) or check `firebase.json` has correct configuration:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/__/auth/**",
        "destination": "/__/auth/handler"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## Monitoring

After deployment:
1. Check Firebase Console → Analytics (if enabled)
2. Monitor Firestore usage in Firebase Console
3. Set up error logging alerts if needed
4. Keep an eye on quota usage

## Backup

Before making major changes:
```bash
# Export Firestore data
firebase firestore:export gs://your-bucket/backup-$(date +%s)
```

## Team Access

Share with team:
- Admin emails for login
- Firestore data structure documentation
- How to add new content
- Support contact for issues

## Maintenance

### Weekly
- [ ] Check admin panel loads correctly
- [ ] Verify new content appears on site

### Monthly
- [ ] Review Firestore usage and quotas
- [ ] Check for any error patterns
- [ ] Update admin allowlist if needed

### As Needed
- [ ] Add new collections/fields
- [ ] Update content management UI
- [ ] Optimize queries if needed
- [ ] Update Firestore security rules

---

**Last Updated:** $(Get-Date)
**Version:** 1.0
**Deployment URL:** https://iic-general.web.app
