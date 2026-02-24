## NestJS

- Don't inject request-scoped providers into singletons
- One module = one domain, no god modules
- Class-validator DTOs for all input validation
- Repository pattern for DB — no QueryBuilder in services
- `ConfigService`, not `process.env`
