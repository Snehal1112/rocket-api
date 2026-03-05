# Bruno vs Rocket Parity Matrix

As of **March 6, 2026**. Feature set mirrors [docs/bruno-feature-inventory.md](./bruno-feature-inventory.md).

## Status Definitions
- **Supported**: Implemented and usable in Rocket.
- **Partial**: Some support exists but not Bruno-equivalent.
- **Missing**: No implementation evidence in this repo.
- **Unknown**: Not enough evidence.

## Matrix
| # | Bruno feature | Tier | Rocket status | Rocket evidence | Gap note |
|---|---|---|---|---|---|
| 1 | API protocols (HTTP/REST/GraphQL/gRPC) | Free | Partial | `backend/internal/interfaces/handlers/request_handler.go`, `frontend/src/components/request-builder/` | HTTP/REST covered; no dedicated GraphQL/gRPC UX found. |
| 2 | Git-native local filesystem collections | Free | Supported | `backend/cmd/server/main.go` (`~/.rocket-api/collections`), `README.md` | Implemented as file-based collections. |
| 3 | Request builder (URL, headers, query, path, body) | Free | Supported | `docs/user-manual.md` section 6, `frontend/src/components/request-builder/RequestBuilder.tsx` | Core editing present. |
| 4 | Auth support | Free | Supported | `backend/pkg/bru/parser.go`, `frontend/src/lib/api.ts` (`auth`) | Basic/bearer/apikey flow present. |
| 5 | Environments and variables | Free | Supported | `backend/cmd/server/main.go` env routes, `frontend/src/lib/api.ts` | CRUD + selection available. |
| 6 | Pre/Post request scripting | Free | Missing | No script execution engine under `backend/internal` | Bruno-style JS scripting not present. |
| 7 | Assertions/testing | Free | Missing | No request assertion runtime found | No Bruno-style assertion UI/runtime. |
| 8 | Collection runner (unlimited runs) | Free | Missing | No collection-runner module/routes found | Single request send exists only. |
| 9 | CLI collection execution | Free | Missing | No Rocket CLI in repo root/backend cmd | No `bru`-like runner CLI. |
| 10 | History | Free | Supported | `backend/cmd/server/main.go` history routes, `frontend/src/lib/api.ts` | List/get/delete/clear implemented. |
| 11 | Secret variables (local encrypted storage) | Free | Partial | `docs/user-manual.md` (secret flags), variable handling in frontend/backend | Secret flag exists; encryption guarantees not evident. |
| 12 | `.env`-based secret workflow | Free | Missing | No `.env` secret resolution pipeline found | No Bruno-style dotenv secret workflow. |
| 13 | Import: Bruno collection | Free | Supported | `/import/bruno` route in `backend/cmd/server/main.go`, `frontend/src/lib/api.ts` | Implemented. |
| 14 | Import: Postman collection | Free | Supported | `/import/postman` route in `backend/cmd/server/main.go`, `frontend/src/lib/api.ts` | Implemented. |
| 15 | Import: Insomnia collection | Free | Missing | No insomnia import route/parser found | Not implemented. |
| 16 | Import: OpenAPI (file/url) | Free | Missing | No openapi import endpoint found | Not implemented. |
| 17 | Import: WSDL | Free | Missing | No wsdl parser/import endpoint found | Not implemented. |
| 18 | Export: Bruno/Postman collections | Free | Supported | `/export/bruno`, `/export/postman` in `backend/cmd/server/main.go` | Implemented. |
| 19 | Theme/display customization | Free | Supported | `frontend/src/App.tsx` (`next-themes`), `docs/user-manual.md` | Light/dark supported. |
| 20 | Git UI core (init/diff/check/pull/clone) | Free | Missing | No Git UI modules/routes under frontend/backend | Not implemented. |
| 21 | Runner CSV data-driven testing | Pro/Ultimate | Missing | No CSV runner support found | Not implemented. |
| 22 | Export collection as OpenAPI spec | Pro/Ultimate | Missing | No OpenAPI export endpoint/generator | Not implemented. |
| 23 | Git UI advanced (commit/push/branch/stash/conflicts) | Pro/Ultimate | Missing | No Git integration subsystem found | Not implemented. |
| 24 | Secret manager integrations (Vault providers) | Ultimate | Missing | No vault/aws/gcp/azure secret-manager integrations | Not implemented. |
| 25 | Postman data export bulk import | Ultimate | Missing | No postman-data-dump importer found | Not implemented. |
| 26 | SSO | Ultimate | Missing | No auth/identity provider integration in app | Not implemented. |
| 27 | SCIM | Ultimate | Missing | No SCIM provisioning endpoints | Not implemented. |
| 28 | License admin portal and user provisioning | Paid | Missing | No license admin backend/frontend modules | Not implemented. |
| 29 | Audit logs (license/admin tier feature) | Ultimate | Missing | No enterprise audit trail subsystem | Not implemented. |

## Summary
- **Total mapped features:** 29
- **Supported:** 9
- **Partial:** 2
- **Missing:** 18
- **Unknown:** 0

## Priority Gaps (Recommended)
1. Add scripting + assertions + collection runner for core Bruno workflow parity.
2. Add OpenAPI import/export and Insomnia import to reduce migration friction.
3. Add secrets roadmap (`.env` workflow first, external secret managers later).
