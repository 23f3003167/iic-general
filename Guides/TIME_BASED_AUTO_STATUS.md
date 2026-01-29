# Time-Based Auto Status Implementation

## Overview

Status is now **automatically computed** based on the current time and date ranges. Zero manual work required!

## How It Works

### Status Logic
```
IF   now < startDate        → Status = "Upcoming"
IF   startDate ≤ now ≤ endDate → Status = "Open"
IF   now > endDate          → Status = "Closed"
```

## Implementation Details

### 1. **Status Compute Function** (`src/lib/statusCompute.ts`)

Core utility function that calculates form status automatically:

```typescript
computeFormStatus(startDate, endDate, startTime?, endTime?): FormStatus
```

**Features:**
- Handles multiple date formats (YYYY-MM-DD, DD/MM/YYYY, ISO)
- Supports optional time specification (HH:mm format)
- Timezone-aware (uses browser's local time)
- Zero manual configuration needed

### 2. **Firestore Service Integration** (`src/lib/firestoreService.ts`)

All form retrieval functions automatically compute status:

- `getForms()` - Returns all forms with auto-computed status
- `getForm(id)` - Returns single form with auto-computed status

**Before:**
```typescript
// Manual status had to be set
const form = { startDate: '2026-01-20', status: 'Upcoming' }
```

**After:**
```typescript
// Status is automatically computed
const form = await getForms() // status field is auto-calculated
```

### 3. **Admin Form Management** (`src/pages/admin/FormsManagement.tsx`)

**Removed:**
- Manual status dropdown selector
- Hardcoded `status: 'Upcoming'` default values
- Manual status editing on form save

**Result:** Admins now only set dates/times - status updates automatically!

## Usage

### For Developers

No changes needed in components. Forms automatically have the correct status:

```typescript
const forms = await getForms()
const openForms = forms.filter(f => f.status === 'Open')
const upcomingForms = forms.filter(f => f.status === 'Upcoming')
const closedForms = forms.filter(f => f.status === 'Closed')
```

### For Admins

When creating/editing a form:
1. Set `startDate` and `endDate` (required)
2. Optionally set `startTime` and `endTime` (HH:mm format)
3. **Status computes automatically** based on current time ✓

## Date Format Support

The implementation handles multiple date formats:

- **YYYY-MM-DD** (ISO format, recommended)
  ```
  2026-01-20
  ```
  
- **DD/MM/YYYY**
  ```
  20/01/2026
  ```

- **Browser-parseable strings**
  ```
  January 20, 2026
  ```

## Time Handling

### Without Time Specified
- Uses midnight (00:00) as default
- Suitable when only date ranges matter

### With Time Specified
- Format: `HH:mm` (24-hour)
- Examples: `14:30`, `09:00`, `23:59`

## Real-World Example

**Scenario:** Form window from Jan 20, 2026 9 AM to Jan 25, 2026 5 PM

**Admin Configuration:**
```
Title:     "Marks Discrepancy Form"
Category:  "Marks"
startDate: "2026-01-20"
startTime: "09:00"
endDate:   "2026-01-25"
endTime:   "17:00"
(Status field removed - not needed!)
```

**Status Over Time:**
| Current Time | Status |
|---|---|
| Jan 19, 8 PM | Upcoming |
| Jan 20, 9 AM | Open |
| Jan 22, 2 PM | Open |
| Jan 25, 6 PM | Closed |

## Benefits

✅ **Zero Manual Work** - Status updates automatically  
✅ **No Admin Errors** - Can't set wrong status  
✅ **Real-Time Accuracy** - Always reflects current time  
✅ **Consistent Behavior** - Single source of truth  
✅ **Simplified UI** - Fewer form fields for admins  

## Files Modified

- `src/lib/statusCompute.ts` - **NEW** (core logic)
- `src/lib/firestoreService.ts` - Updated (auto-compute on fetch)
- `src/pages/admin/FormsManagement.tsx` - Updated (removed status field)
- `src/types/index.ts` - No changes needed

## Technical Notes

- Status is computed **at fetch time** (not stored in DB)
- This is intentional - ensures accuracy as time passes
- Each component automatically gets current status
- No additional setup or configuration required
