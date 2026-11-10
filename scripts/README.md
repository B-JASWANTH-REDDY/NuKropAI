# NuKropAI Engineering Scripts Directory

This directory contains enterprise automation, migration, remediation, and operational tooling for the NuKropAI Agricultural Intelligence Operating System.

---

## Directory Organization & Purpose

| Script / Asset | Runtime | Category | Description |
| :--- | :--- | :--- | :--- |
| `audit_live_supabase_schema.py` | Python 3 | **Database / Audit** | Inspects live Supabase database schemas, table definitions, foreign keys, and RLS policies. |
| `apply_critical_security_remediations.py` | Python 3 | **Security / RLS** | Applies fail-closed PostGIS RLS rules, role isolation, and security hardening migrations. |
| `fix_view_dependency_and_cast.py` | Python 3 | **Database / Migration** | Resolves Postgres view dependencies, type casts, and trigger functions across migrations. |
| `apply_permanent_standards.js` | Node.js | **Mobile Standards** | Injects and validates 40 Permanent Mobile Standards across the application engine. |
| `mobile_standards.css` | CSS | **Styling / Tokens** | Enterprise CSS tokens for safe-area insets, bottom navigation, elevation, and typography. |
| `mobile_standards_snippet.js` | JavaScript | **Runtime / UX** | Micro-interaction handlers, gesture recognition, and responsive viewport adapters. |
| `modern_community_follow.js` | JavaScript | **Feature Logic** | Follow/unfollow state synchronization with atomic optimistic updates. |
| `modern_community_mutations.js` | JavaScript | **Feature Logic** | Community post creation, likes, and feed mutation helpers. |
| `modern_khata_delete.js` | JavaScript | **Feature Logic** | Farm Khata bookkeeping entry deletion with 5-second undo toast recovery. |
| `generate_complete_all_in_one.py` | Python 3 | **Packaging** | Bundles all static assets and runtime scripts into single-file distribution artifacts. |
| `build_all_in_one.py` | Python 3 | **Packaging** | Verification and build script for standalone testing bundles. |

---

## Execution Standards

1. **Production Safety**: Never run database remediation scripts against the production Supabase reference without prior validation via `simulations/mirofish_adapter/target_validator.py`.
2. **Deterministic Outputs**: All migration and data transformation scripts must be idempotent.
3. **No Direct Execution in CI**: CI runs use dedicated test suites under `tests/`; scripts in this directory are reserved for operator workflows and automated remediation passes.

