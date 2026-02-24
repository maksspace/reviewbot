## Vitest

- Same rules as Jest, prefer `vi.fn()`/`vi.spyOn()` over jest globals
- Describe blocks match the unit being tested
- One assertion per test when possible
- No test interdependence
- Mock externals, not internals
- Behavior-based names: "should return 404 when user not found"
