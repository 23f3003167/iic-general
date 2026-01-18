# Admin Dashboard CRUD Operations Guide

## Overview
The admin dashboard now has full CRUD (Create, Read, Update, Delete) functionality for managing:
- Forms
- Announcements  
- FAQs
- Documents

## Access Control
- Only authenticated users with emails listed in Firestore `admins/allowed` document can access the admin panel
- Google Sign-In authentication is required
- Unauthorized users are automatically logged out and redirected

## Navigation Structure

### Dashboard Routes:
- `/admin` - Admin login page
- `/admin/dashboard` - Overview with statistics
- `/admin/forms` - Forms management
- `/admin/announcements` - Announcements management
- `/admin/faqs` - FAQs management
- `/admin/documents` - Documents management

## Features by Section

### 1. Forms Management (`/admin/forms`)

**Data Fields:**
- Title (required)
- Category (Academics, Internships, Placements, Scholarships, Competitions, Other)
- Description (required)
- Status (Open, Closed, Coming Soon)
- Start Date (required)
- End Date (required)
- Form URL (required)

**Operations:**
- **Create**: Click "Create New Form" button, fill dialog form, submit
- **Read**: All forms displayed in grid with badges showing category and status
- **Update**: Click "Edit" button on any form card, modify fields, save
- **Delete**: Click "Delete" button, confirm in dialog

**Visual Features:**
- Color-coded category badges
- Status badges (Open/Closed/Coming Soon)
- Date range display
- External link to form URL

### 2. Announcements Management (`/admin/announcements`)

**Data Fields:**
- Title (required)
- Content (required)
- Date (auto-generated, editable)
- Important flag (toggle)

**Operations:**
- **Create**: Click "Create New Announcement", fill form, set importance toggle
- **Read**: All announcements in card layout with important badges
- **Update**: Click "Edit", modify content, change importance
- **Delete**: Click "Delete", confirm action

**Visual Features:**
- Important badge for high-priority announcements
- Date display
- Card-based layout for easy scanning

### 3. FAQs Management (`/admin/faqs`)

**Data Fields:**
- Question (required)
- Answer (required)

**Operations:**
- **Create**: Click "Add New FAQ", enter question and detailed answer
- **Read**: FAQs displayed in accordion format for easy browsing
- **Update**: Click "Edit" next to any FAQ, modify text
- **Delete**: Click "Delete", confirm removal

**Visual Features:**
- Accordion UI for collapsible Q&A pairs
- Inline edit/delete buttons
- Clean, readable layout

### 4. Documents Management (`/admin/documents`)

**Data Fields:**
- Title (required)
- Description (required)
- URL (required)
- Type (PDF, Drive, External Link)

**Operations:**
- **Create**: Click "Create New Document", fill details, select type
- **Read**: Documents in grid with type badges and external link icons
- **Update**: Click "Edit", change document details
- **Delete**: Click "Delete", confirm deletion

**Visual Features:**
- Type badges (PDF/Drive/External)
- External link icon for direct access
- Grid layout with document cards

## Firestore Data Structure

### Collections:

**forms**
```json
{
  "title": "string",
  "category": "string",
  "description": "string",
  "status": "string",
  "startDate": "string",
  "endDate": "string",
  "url": "string"
}
```

**announcements**
```json
{
  "title": "string",
  "content": "string",
  "date": "string",
  "important": "boolean"
}
```

**faqs**
```json
{
  "question": "string",
  "answer": "string"
}
```

**documents**
```json
{
  "title": "string",
  "description": "string",
  "url": "string",
  "type": "string"
}
```

**admins/allowed**
```json
{
  "emails": ["admin1@example.com", "admin2@example.com"]
}
```

## Firestore Service Layer

Location: `src/lib/firestoreService.ts`

**Available Functions:**

Forms:
- `getForms()` - Fetch all forms
- `createForm(form)` - Add new form
- `updateForm(id, form)` - Update existing form
- `deleteForm(id)` - Delete form

Announcements:
- `getAnnouncements()` - Fetch all announcements
- `createAnnouncement(announcement)` - Add new announcement
- `updateAnnouncement(id, announcement)` - Update announcement
- `deleteAnnouncement(id)` - Delete announcement

FAQs:
- `getFAQs()` - Fetch all FAQs
- `createFAQ(faq)` - Add new FAQ
- `updateFAQ(id, faq)` - Update FAQ
- `deleteFAQ(id)` - Delete FAQ

Documents:
- `getDocuments()` - Fetch all documents
- `createDocument(document)` - Add new document
- `updateDocument(id, document)` - Update document
- `deleteDocument(id)` - Delete document

## Security Rules

Your Firestore security rules should allow:
- Read access to all collections for all users (public data)
- Write access only to admin-authenticated users
- Read access to `admins/allowed` for authenticated users (for verification)

Example rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      let adminEmails = get(/databases/$(database)/documents/admins/allowed).data.emails;
      return request.auth != null && request.auth.token.email.lower() in adminEmails;
    }
    
    match /admins/allowed {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    match /{collection}/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

## Usage Instructions

### Adding an Admin User:
1. Go to Firebase Console → Firestore Database
2. Navigate to `admins` collection → `allowed` document
3. Add email address to the `emails` array
4. User can now log in with that Google account

### Creating Content:
1. Log in via `/admin`
2. Navigate to desired section (Forms/Announcements/FAQs/Documents)
3. Click "Create New" or "Add New" button
4. Fill required fields (marked with *)
5. Click "Create" or "Save"

### Editing Content:
1. Find the item you want to edit
2. Click "Edit" button
3. Modify fields in the dialog
4. Click "Save Changes"

### Deleting Content:
1. Find the item you want to delete
2. Click "Delete" button
3. Confirm in the confirmation dialog
4. Item is permanently removed

## Dashboard Statistics

The overview page (`/admin/dashboard`) shows:
- Total count of forms
- Total count of announcements
- Total count of FAQs
- Total count of documents

These stats are loaded from Firestore in real-time.

## Error Handling

All CRUD operations include:
- Try-catch blocks for error handling
- Toast notifications for success/failure
- Console logging for debugging
- Loading states during operations

## Next Steps

### To Deploy:
```bash
npm run build
firebase deploy --only hosting
```

### To Add More Admin Users:
Update Firestore `admins/allowed` document with new email addresses

### To Customize:
- Modify form fields in respective management components
- Update Firestore service functions for additional operations
- Add custom validation rules in dialog forms
- Adjust styling with Tailwind classes

## File Structure

```
src/
├── lib/
│   ├── firebase.ts                    # Firebase initialization
│   ├── adminAuth.ts                   # Admin verification helpers
│   └── firestoreService.ts            # CRUD operations
├── pages/
│   └── admin/
│       ├── AdminLogin.tsx             # Login page
│       ├── AdminDashboard.tsx         # Main dashboard with routing
│       ├── FormsManagement.tsx        # Forms CRUD
│       ├── AnnouncementsManagement.tsx # Announcements CRUD
│       ├── FAQsManagement.tsx         # FAQs CRUD
│       └── DocumentsManagement.tsx    # Documents CRUD
└── App.tsx                            # Route configuration
```

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Firestore security rules
3. Confirm admin email is in allowlist
4. Check Firebase Authentication is enabled
5. Ensure authorized domains are configured

---

**Created:** $(Get-Date)
**Version:** 1.0
**Framework:** React 18 + TypeScript + Firebase + shadcn/ui
