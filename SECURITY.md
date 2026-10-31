# Security Policy

## Supported Versions

Only the latest version deployed at [logi-bot.pages.dev](https://logi-bot.pages.dev) is actively maintained.

## Scope

This policy covers the logi-bot web application, including:

- Cloudflare Pages frontend (`public/`)
- Pages Functions API (`functions/`)

The following are **out of scope**:
- Third-party libraries (Mermaid.js, Anthropic SDK, etc.)
- Upstream LLM provider APIs (Anthropic, Google, OpenAI)

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** file a public GitHub issue.

Instead, report it via one of the following:

1. **GitHub Private Vulnerability Reporting** — use the [Security tab](../../security/advisories/new) of this repository (Settings > Security > Advisories)
2. **Email** — send details to the repository owner listed in the GitHub profile

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations (optional)

## Response Timeline

| Step | Target |
|------|--------|
| Acknowledgement | Within 7 days |
| Initial assessment | Within 14 days |
| Fix or mitigation | Best effort (personal project) |

## Disclosure Policy

This is a personal/hobby project maintained by a single developer. Coordinated disclosure is appreciated. Please allow reasonable time for a fix before public disclosure.

## Notes on Architecture

- **BYOK mode**: When users provide their own API keys, those keys are transmitted as HTTP request headers to the Pages Functions backend and used server-side only. Keys are never logged or persisted.
- **Session state**: All session data is stored client-side in `localStorage`. No user data is stored server-side.
- **Owner mode**: The owner passcode is stored as a Cloudflare Pages environment secret and never exposed to clients.
