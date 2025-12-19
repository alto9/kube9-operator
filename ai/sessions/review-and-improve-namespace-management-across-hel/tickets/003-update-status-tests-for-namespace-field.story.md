---
story_id: update-status-tests-for-namespace-field
session_id: review-and-improve-namespace-management-across-hel
feature_id:
  - status-exposure
spec_id:
  - status-api-spec
status: completed
estimated_minutes: 20
---

# Update status tests for namespace field

## Objective

Update all status-related unit tests to include and validate the new `namespace` field in OperatorStatus objects.

## Context

The OperatorStatus interface now includes a required `namespace` field. All tests that create or validate OperatorStatus objects need to be updated to include this field.

## Acceptance Criteria

- [x] All test files importing or using OperatorStatus are updated
- [x] Test assertions validate namespace field is present
- [x] Test cases verify namespace uses POD_NAMESPACE environment variable
- [x] Test cases verify fallback to "kube9-system" when POD_NAMESPACE not set
- [x] All tests pass successfully
- [x] No TypeScript compilation errors

## Files to Modify

- `tests/status/calculator.test.ts` (or equivalent) - Update calculateStatus tests
- Any other test files that mock or validate OperatorStatus objects

## Implementation Guidance

### Update Test Expectations

For each test that validates OperatorStatus:

```typescript
expect(status).toMatchObject({
  mode: 'operated',
  tier: 'free',
  version: '1.0.0',
  health: 'healthy',
  registered: false,
  apiKeyConfigured: false,
  error: null,
  namespace: 'kube9-system',  // ADD THIS
  // ... other fields
});
```

### Add Environment Variable Tests

Add test cases for namespace detection:

```typescript
describe('namespace field', () => {
  it('should use POD_NAMESPACE environment variable when set', () => {
    process.env.POD_NAMESPACE = 'custom-namespace';
    const status = calculateStatus();
    expect(status.namespace).toBe('custom-namespace');
    delete process.env.POD_NAMESPACE;
  });
  
  it('should fallback to kube9-system when POD_NAMESPACE not set', () => {
    delete process.env.POD_NAMESPACE;
    const status = calculateStatus();
    expect(status.namespace).toBe('kube9-system');
  });
});
```

## Related Scenarios

From `ai/features/core/status-exposure.feature.md`:
- Scenario: "Operator advertises its namespace in status"
- Scenario: "Namespace defaults to kube9-system"

## Testing Strategy

1. Run tests to identify all failures due to missing namespace field
2. Update each test systematically
3. Add new test cases specifically for namespace detection
4. Verify all tests pass with `npm test`

## Notes

- This story depends on Stories 001 and 002 being completed first
- If no tests exist yet for status calculator, note that in commit message
- Focus on unit tests - integration tests may be separate story if needed

