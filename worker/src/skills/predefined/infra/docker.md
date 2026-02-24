## Docker

- Multi-stage builds
- Non-root `USER`
- Pin base image versions (not `:latest`)
- `COPY package*.json` first for layer caching
- No secrets in build args or `ENV`
