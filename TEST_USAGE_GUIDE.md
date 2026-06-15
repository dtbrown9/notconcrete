# Test Usage Guide

## Quick Start

### 1. Run All Tests Once
```bash
npm run test:run
```
Perfect for CI/CD pipelines or validating code before committing.

### 2. Run Tests in Watch Mode
```bash
npm run test
```
Automatically re-runs tests when you save files. Great for development!

### 3. Open Interactive Test UI
```bash
npm run test:ui
```
Opens a browser-based test explorer where you can:
- See test results in real-time
- Click on tests to see details
- Filter and search tests
- View coverage metrics

### 4. Generate Coverage Report
```bash
npm run test:coverage
```
Creates an HTML coverage report showing what percentage of your code is tested.

---

## Test Structure

### 3 Test Files

**1. AdminDashboard.test.tsx** (42 tests)
- Password setup and validation
- Login authentication
- Password change functionality
- Dashboard quote management
- Search and filtering
- CSV export
- Error handling

**2. adminApi.test.ts** (23 tests)
- Password hashing
- API endpoint validation
- Database schema validation
- Authorization checks
- Error responses

**3. adminIntegration.test.ts** (22 tests)
- Full password lifecycle
- Quote management with auth
- Search and filter combinations
- Session management
- Concurrent operations
- Data persistence

---

## What Gets Tested

✅ **Password Management**
- Can you create a password during setup?
- Does it validate minimum length (6 chars)?
- Does it prevent mismatched passwords?
- Can you log in with the password?
- Can you change your password?
- Does the new password work after change?

✅ **Quote Management**
- Can you see all quotes in the dashboard?
- Can you filter quotes by status?
- Can you search quotes by name/email/phone?
- Can you update a quote's status?
- Can you delete a quote?
- Can you export quotes to CSV?

✅ **Authentication**
- Are endpoints protected by password?
- Does the authorization header work?
- Does invalid password get rejected?
- Does old password fail after password change?

✅ **Data**
- Does quote data persist?
- Does password persist across sessions?
- Does status change persist?

---

## Example Test Output

```
✅ Test Files  3 passed (3)
   ├─ src/pages/AdminDashboard.test.tsx (42 tests)
   ├─ src/__tests__/adminApi.test.ts (23 tests)
   └─ src/__tests__/adminIntegration.test.ts (22 tests)

✅ Tests  87 passed (87)
   ├─ Password Management (19 tests) ✅
   ├─ Authentication (11 tests) ✅
   ├─ Quote Management (24 tests) ✅
   ├─ Database/Schema (5 tests) ✅
   ├─ Integration Flows (18 tests) ✅
   └─ Error Handling (10 tests) ✅

⏱️  Duration  2.19s
```

---

## Common Test Commands

### Run specific test file
```bash
npm run test:run src/pages/AdminDashboard.test.tsx
```

### Run tests matching pattern
```bash
npm run test:run -- --grep "Password"
```

### Run with verbose output
```bash
npm run test:run -- --reporter=verbose
```

### Watch mode with specific file
```bash
npm run test -- src/pages/AdminDashboard.test.tsx
```

---

## Debugging Tests

### Run single test
In the Vitest UI, click on a test to run just that one.

### Print debug info
Add `console.log()` statements in tests - they'll show in the output.

### View test details
Open the Vitest UI (`npm run test:ui`) to see detailed results for each test.

---

## Continuous Integration

To use tests in CI/CD (GitHub Actions, GitLab CI, etc.):

```bash
npm run test:run
```

Exit code:
- `0` = all tests passed ✅
- `1` = some tests failed ❌

---

## Test Coverage

Run coverage report:
```bash
npm run test:coverage
```

This creates an `coverage/` directory with HTML reports showing:
- Overall coverage percentage
- Which lines are tested
- Which functions are tested
- Which branches are covered

---

## Writing New Tests

### Pattern 1: Simple Validation
```javascript
it('should reject short password', () => {
  const password = 'short'
  expect(password.length).toBeLessThan(6)
})
```

### Pattern 2: Data Transformation
```javascript
it('should filter quotes by status', () => {
  const quotes = [
    { id: 1, status: 'new' },
    { id: 2, status: 'completed' },
  ]
  const filtered = quotes.filter(q => q.status === 'new')
  expect(filtered.length).toBe(1)
})
```

### Pattern 3: Integration Flow
```javascript
it('should complete password change', () => {
  // Setup
  const currentPassword = 'old'
  // Act
  const newPassword = 'new'
  // Assert
  expect(newPassword).not.toBe(currentPassword)
})
```

---

## Test Best Practices Used

1. **Clear naming**: Test names describe what should happen
2. **Single assertion**: Each test checks one thing
3. **No dependencies**: Tests don't depend on each other
4. **Organized groups**: Related tests in `describe()` blocks
5. **Setup/cleanup**: Tests clean up after themselves
6. **Real-world scenarios**: Tests match actual user behavior

---

## Troubleshooting

### Tests not running?
```bash
npm install
npm run test:run
```

### Tests failing after code change?
1. Read the error message
2. Look at the failing test
3. Update the code or test as needed
4. Run tests again

### Tests too slow?
- Check for missing mocks
- Look for unnecessary delays
- Profile with `npm run test:run -- --reporter=verbose`

### Need to debug a test?
1. Open Vitest UI: `npm run test:ui`
2. Click on failing test
3. Check the error details
4. Look at the test code to understand what went wrong

---

## Success Criteria

All tests passing means:
✅ Password management works correctly
✅ Quotes can be managed properly
✅ Authentication is secure
✅ Data persists correctly
✅ Error handling is robust
✅ No unhandled edge cases

---

## Next Steps

After tests are passing:
1. Deploy with confidence
2. Refactor safely (tests catch regressions)
3. Add new features (tests ensure nothing breaks)
4. Monitor production (tests validate before release)

---

## Questions?

Check the test files for examples:
- `src/pages/AdminDashboard.test.tsx` - Component tests
- `src/__tests__/adminApi.test.ts` - API tests
- `src/__tests__/adminIntegration.test.ts` - Full flow tests

Each test is self-documenting with clear names and assertions.
