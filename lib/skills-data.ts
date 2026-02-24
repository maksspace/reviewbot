// Static predefined skills data for the frontend Skills Library page.
// Mirrors the markdown files in worker/src/skills/predefined/.

export type SkillCategory = 'languages' | 'frameworks' | 'patterns' | 'testing' | 'infra'

export interface SkillInfo {
  id: string
  name: string
  category: SkillCategory
  content: string
}

export const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: 'languages', label: 'Languages' },
  { id: 'frameworks', label: 'Frameworks' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'testing', label: 'Testing' },
  { id: 'infra', label: 'Infrastructure' },
]

export const PREDEFINED_SKILLS: SkillInfo[] = [
  // Languages
  {
    id: 'typescript',
    name: 'TypeScript',
    category: 'languages',
    content: `- Avoid \`any\` \u2014 use \`unknown\` and narrow with type guards
- No non-null assertions (\`!\`) in new code
- Prefer \`satisfies\` over \`as\` for type validation
- Explicit return types on public/exported functions
- No \`enum\` \u2014 use \`as const\` objects
- Prefer discriminated unions over type assertions`,
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    category: 'languages',
    content: `- Use \`===\` not \`==\`
- No \`var\` \u2014 use \`const\`, then \`let\` only when needed
- No implicit globals
- No prototype mutation`,
  },
  {
    id: 'python',
    name: 'Python',
    category: 'languages',
    content: `- Type hints on public function signatures
- No mutable default arguments
- Context managers for resources
- No bare \`except:\` \u2014 specify exception type`,
  },
  {
    id: 'go',
    name: 'Go',
    category: 'languages',
    content: `- Always check error returns \u2014 no \`_\` for errors
- Early returns over deep nesting
- No \`init()\` unless strictly necessary
- Close resources with \`defer\` immediately after creation`,
  },
  {
    id: 'rust',
    name: 'Rust',
    category: 'languages',
    content: `- No \`.unwrap()\` \u2014 use \`.unwrap_or_default()\` or \`?\`
- No \`.clone()\` without justification
- \`thiserror\` for library errors, \`anyhow\` for apps`,
  },
  {
    id: 'java',
    name: 'Java',
    category: 'languages',
    content: `- No raw types \u2014 parameterize generics
- \`Optional\` over null returns
- Try-with-resources for all closeable resources
- Immutable DTOs where possible`,
  },

  // Frameworks
  {
    id: 'nestjs',
    name: 'NestJS',
    category: 'frameworks',
    content: `- Don't inject request-scoped providers into singletons
- One module = one domain, no god modules
- Class-validator DTOs for all input validation
- Repository pattern for DB \u2014 no QueryBuilder in services
- \`ConfigService\`, not \`process.env\``,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'frameworks',
    content: `- Server Components by default, \`"use client"\` only when needed
- No data fetching in client components
- \`next/image\` for image optimization
- \`NEXT_PUBLIC_\` prefix only for client-safe env vars`,
  },
  {
    id: 'react',
    name: 'React',
    category: 'frameworks',
    content: `- No state mutation \u2014 always new objects/arrays
- No \`useEffect\` for data fetching \u2014 use a query library or server components
- Custom hooks for reusable logic
- Stable keys, never array index for dynamic lists
- No prop drilling beyond 2 levels`,
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'frameworks',
    content: `- Composition API for new code
- Computed over watch when possible
- No direct DOM manipulation
- Components under 200 lines`,
  },
  {
    id: 'express',
    name: 'Express',
    category: 'frameworks',
    content: `- Validate all request input
- Error middleware at end of chain
- No business logic in route handlers
- Async/await with error catching`,
  },
  {
    id: 'fastify',
    name: 'Fastify',
    category: 'frameworks',
    content: `- JSON Schema for request/response validation
- Proper plugin encapsulation
- No synchronous operations in handlers`,
  },
  {
    id: 'django',
    name: 'Django',
    category: 'frameworks',
    content: `- No raw SQL in views \u2014 use the ORM
- \`select_related\`/\`prefetch_related\` for N+1 queries
- Service layer for business logic
- Timezone-aware datetime always`,
  },

  // Patterns
  {
    id: 'microservices',
    name: 'Microservices',
    category: 'patterns',
    content: `- No shared databases between services
- Services own their data
- Idempotent event handlers
- Sagas over 2PC for distributed transactions`,
  },
  {
    id: 'grpc',
    name: 'gRPC',
    category: 'patterns',
    content: `- Backward compatible proto changes only
- Never reuse deleted field numbers
- Deadline propagation \u2014 always set and forward`,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    category: 'patterns',
    content: `- DataLoader for N+1 batching
- Nullable by default
- Cursor-based pagination
- Input types for mutations
- Depth/complexity limits`,
  },
  {
    id: 'rest-api',
    name: 'REST API',
    category: 'patterns',
    content: `- Plural resource names (\`/users\`, \`/orders\`)
- Proper HTTP methods (GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes)
- Meaningful status codes
- Pagination on list endpoints`,
  },
  {
    id: 'event-driven',
    name: 'Event-Driven Architecture',
    category: 'patterns',
    content: `- Past tense event names (\`UserCreated\`, \`OrderShipped\`)
- Idempotent handlers
- Dead letter queue for failures
- Schema validation on publish and consume`,
  },
  {
    id: 'cqrs',
    name: 'CQRS',
    category: 'patterns',
    content: `- Commands return void or ID only
- Queries never modify state
- Separate read/write models`,
  },

  // Testing
  {
    id: 'jest',
    name: 'Jest',
    category: 'testing',
    content: `- Describe blocks match the unit being tested
- One assertion per test when possible
- No test interdependence
- Mock externals, not internals
- Behavior-based names: "should return 404 when user not found"`,
  },
  {
    id: 'vitest',
    name: 'Vitest',
    category: 'testing',
    content: `- Same rules as Jest, prefer \`vi.fn()\`/\`vi.spyOn()\` over jest globals
- Describe blocks match the unit being tested
- One assertion per test when possible
- No test interdependence
- Mock externals, not internals
- Behavior-based names: "should return 404 when user not found"`,
  },
  {
    id: 'pytest',
    name: 'pytest',
    category: 'testing',
    content: `- Fixtures for setup, not \`setUp\`/\`tearDown\`
- Parametrize repetitive cases
- \`monkeypatch\` for env overrides
- Separate unit/integration directories`,
  },
  {
    id: 'cypress',
    name: 'Cypress',
    category: 'testing',
    content: `- No \`cy.wait(ms)\` \u2014 use \`cy.intercept()\` for network waits
- \`data-testid\` selectors
- No conditional testing
- State setup via API, not UI`,
  },
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'testing',
    content: `- Web-first assertions
- User-visible locators (\`getByRole\`, \`getByText\`)
- No hardcoded timeouts
- Fresh context per test`,
  },

  // Infra
  {
    id: 'docker',
    name: 'Docker',
    category: 'infra',
    content: `- Multi-stage builds
- Non-root \`USER\`
- Pin base image versions (not \`:latest\`)
- \`COPY package*.json\` first for layer caching
- No secrets in build args or \`ENV\``,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'infra',
    content: `- Resource requests and limits on every deployment
- Readiness and liveness probes
- Specific image versions, no \`:latest\`
- ConfigMaps/Secrets, not hardcoded values`,
  },
  {
    id: 'terraform',
    name: 'Terraform',
    category: 'infra',
    content: `- No hardcoded values \u2014 use variables
- Remote state with locking
- Modules for reusable infrastructure
- Tag all resources`,
  },
]
