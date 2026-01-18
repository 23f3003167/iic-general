# Quick Start Guide - Admin Dashboard

## Getting Started

### 1. Login to Admin Panel
1. Go to https://iic-general.web.app/admin
2. Click "Sign in with Google"
3. Select your Google account
4. You should be redirected to `/admin/dashboard`

If you see "Unauthorized" message:
- Your email isn't in the admin allowlist
- Contact team lead to add your email

### 2. Navigate Admin Dashboard
The sidebar shows 5 sections:
- **Overview** - Statistics and quick actions
- **Forms** - Manage placement forms
- **Announcements** - News and updates
- **FAQs** - Q&A pairs
- **Documents** - Resource links

## Common Tasks

### Creating Content

#### Add a Form
1. Go to Forms section
2. Click "Create New Form" button
3. Fill in:
   - **Title**: Form name (e.g., "Marks Discrepancy Form")
   - **Category**: Select type (Academics, Internships, Placements, etc.)
   - **Description**: Brief description
   - **Status**: Open / Closed / Coming Soon
   - **Start Date**: When form opens
   - **End Date**: When form closes
   - **Form URL**: Link to Google Form
4. Click "Create Form"
5. Success message should appear

#### Add an Announcement
1. Go to Announcements section
2. Click "Create New Announcement"
3. Fill in:
   - **Title**: Headline
   - **Content**: Full text
   - **Important**: Toggle if urgent
4. Click "Create"

#### Add an FAQ
1. Go to FAQs section
2. Click "Add New FAQ"
3. Fill in:
   - **Question**: The FAQ question
   - **Answer**: Detailed answer
4. Click "Create"

#### Add a Document
1. Go to Documents section
2. Click "Create New Document"
3. Fill in:
   - **Title**: Document name
   - **Description**: What it contains
   - **Type**: PDF / Google Drive / External Link
   - **URL**: Link to document
4. Click "Create"

### Editing Content

1. Find the item you want to edit
2. Click "Edit" button
3. Update fields as needed
4. Click "Save Changes"

### Deleting Content

1. Find the item to delete
2. Click "Delete" button
3. Confirm in dialog: "Are you sure?"
4. Item is permanently deleted

## Viewing Your Changes

### Check Forms
1. Go to home page (https://iic-general.web.app/)
2. Forms are grouped by status:
   - **Open Forms** - Available now
   - **Upcoming Forms** - Coming soon
   - **Closed Forms** - Closed forms (collapsed)

### Check Announcements
1. Go to https://iic-general.web.app/announcements
2. Important announcements have a special badge
3. Sorted by date (newest first)

### Check FAQs
1. Go to https://iic-general.web.app/faqs
2. Questions displayed in expandable accordion

### Check Documents
1. Go to https://iic-general.web.app/documents
2. Click "Open Document" to access the link

## Dashboard Statistics

The overview page shows:
- **Total Forms** - Count of all forms
- **Announcements** - Total announcements
- **FAQs** - Total Q&A pairs
- **Documents** - Total resources

These update in real-time as you add/remove content.

## Tips & Tricks

### Best Practices
✓ Use clear, descriptive titles
✓ Write detailed descriptions
✓ Keep announcements concise
✓ Use Important flag only when necessary
✓ Include full URLs for forms/documents
✓ Set correct dates for form deadlines

### Common Mistakes to Avoid
✗ Leaving required fields (*) empty
✗ Forgetting to update end dates for closed forms
✗ Using broken or incomplete URLs
✗ Typos in important information
✗ Forgetting to toggle "Important" for urgent announcements

## Troubleshooting

### "Unauthorized" Error
- Your email isn't in the admin list
- Contact team lead with your email

### Can't See Changes on Website
- Wait 5-10 seconds for Firestore to sync
- Refresh the page (Ctrl+R or Cmd+R)
- Clear browser cache if needed

### Form Won't Submit
- Check all required fields (*) are filled
- Check URLs are valid (start with http/https)
- Check dates are in correct format

### Lost Connection
- Check your internet connection
- Try logging out and back in
- Refresh the page

### Need Help?
1. Check the detailed ADMIN_CRUD_GUIDE.md
2. Check browser console for error messages (F12)
3. Contact your team lead or developer

## Menu Options

| Section | Purpose | Key Actions |
|---------|---------|------------|
| Dashboard | Overview & Stats | View totals, Quick links |
| Forms | Placement Forms | Create, Edit, Delete forms |
| Announcements | News & Updates | Create announcements, Mark important |
| FAQs | Q&A Section | Add questions and answers |
| Documents | Resources | Upload/link documents |

## Keyboard Shortcuts

- `Ctrl+K` (Windows) / `Cmd+K` (Mac) - Open command palette (if enabled)
- `Escape` - Close dialogs
- `Tab` - Navigate form fields
- `Enter` - Submit form (if cursor in submit button)

## Data Limits

| Item | Limit |
|------|-------|
| Form Title | 100 characters |
| Description | 500 characters |
| Announcement Title | 100 characters |
| Announcement Content | 2000 characters |
| FAQ Question | 200 characters |
| FAQ Answer | 2000 characters |
| Document Title | 100 characters |
| Admin Emails | ~100 users |

## First Time Setup Checklist

- [ ] Received admin access email
- [ ] Logged in successfully
- [ ] Can see admin dashboard
- [ ] Created first form/announcement/FAQ
- [ ] Verified it appears on public pages
- [ ] Invited team members
- [ ] Set up regular update schedule

## Support Contacts

- **Technical Issues**: [Developer Email]
- **Content Questions**: [Team Lead Email]
- **Access/Permissions**: [Admin Email]

## FAQ

**Q: How long does it take for changes to appear?**
A: Usually instantly, but up to 10 seconds maximum.

**Q: Can I undo a deletion?**
A: No, deletions are permanent. Be careful!

**Q: How many people can be admins?**
A: Unlimited, but start with core team.

**Q: Can I schedule content for later?**
A: Not currently, content goes live immediately when created.

**Q: Are there backups of my data?**
A: Yes, Firebase automatically maintains backups.

**Q: Can students edit content?**
A: No, only admin-approved emails can edit.

---

**Version**: 1.0
**Last Updated**: 2024
**Next Review**: 30 days
