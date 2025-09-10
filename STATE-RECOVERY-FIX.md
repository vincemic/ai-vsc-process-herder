# State Recovery Bug Fix

## Problem Description

**Error**: `TypeError: processState.startTime.getTime is not a function`

**Impact**: Minimal - doesn't affect new process management, only affects recovery from previous sessions

**Root Cause**: When process state was saved to disk as JSON and later loaded back, Date objects were deserialized as strings instead of Date objects. The code then tried to call `.getTime()` on these string values, causing the TypeError.

## Technical Details

### The Issue
1. Process state is saved to disk as JSON when the application shuts down
2. When JSON is parsed back from disk, Date objects become strings
3. Code in several places assumed `startTime` was still a Date object and called `.getTime()` on it
4. This caused `TypeError: startTime.getTime is not a function`

### Affected Files
- `src/state-manager.ts` - Primary issue in `loadPreviousState()` and `loadSnapshot()`
- `src/process-manager.ts` - Secondary issue in `getProcessStatus()`
- `src/health-monitor.ts` - Secondary issue in `calculateMetrics()`

## Solution

### 1. Added Date Deserialization Methods

Added two new private methods to `ProcessStateManager`:

```typescript
private deserializeSessionData(rawSession: any): SessionData {
  // Converts string dates back to Date objects for session data
}

private deserializeSnapshotData(rawSnapshot: any): ProcessSnapshot {
  // Converts string dates back to Date objects for snapshot data
}
```

### 2. Updated State Loading Methods

- Modified `loadPreviousState()` to use `deserializeSessionData()`
- Modified `loadSnapshot()` to use `deserializeSnapshotData()`

### 3. Added Safe Date Handling

Added `safeDateToTime()` helper methods to handle both Date objects and date strings:

```typescript
private safeDateToTime(date: Date | string | undefined): number | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') {
    return new Date(date).getTime();
  }
  if (date instanceof Date) {
    return date.getTime();
  }
  return undefined;
}
```

### 4. Updated Date Access Patterns

Updated all places where `startTime.getTime()` was called to use the safe method:

```typescript
// Before
uptime: metadata?.startTime ? Date.now() - metadata.startTime.getTime() : undefined

// After  
uptime: metadata?.startTime ? Date.now() - this.safeDateToTime(metadata.startTime)! : undefined
```

## Verification

Created and ran a comprehensive test (`test-state-recovery.js`) that:
1. ✅ Creates a process state manager and registers a process
2. ✅ Saves state to disk and simulates app restart  
3. ✅ Loads state back and verifies Date objects are properly deserialized
4. ✅ Tests the critical `startTime.getTime()` operations that previously failed
5. ✅ Tests snapshot deserialization as well

**Test Result**: All tests passed successfully! 🎉

## Files Modified

1. **src/state-manager.ts**
   - Added `deserializeSessionData()` method
   - Added `deserializeSnapshotData()` method  
   - Updated `loadPreviousState()` to use proper deserialization
   - Updated `loadSnapshot()` to use proper deserialization

2. **src/process-manager.ts**
   - Added `safeDateToTime()` helper method
   - Updated two instances of `startTime.getTime()` to use safe method

3. **src/health-monitor.ts**
   - Added `safeDateToTime()` helper method
   - Updated uptime calculation to use safe method

4. **test-state-recovery.js** (new)
   - Comprehensive test to verify the fix works

## Impact Assessment

- ✅ **No breaking changes** - New processes continue to work exactly as before
- ✅ **Backward compatible** - Existing state files will be properly deserialized
- ✅ **Minimal risk** - Only affects state recovery, which was already broken
- ✅ **Well tested** - Custom test confirms the fix works
- ✅ **No performance impact** - Deserialization only happens at startup

## Status

**FIXED** ✅ - The state recovery bug has been successfully resolved. Process state recovery from previous sessions now works correctly without throwing TypeErrors.