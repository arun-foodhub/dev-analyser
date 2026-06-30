---
name: analyse
description: Given a bug description, Jira ticket, or feature request, identify which repos and files are involved, trace the API path end-to-end, and produce a concrete action plan. Use whenever a task mentions a bug, feature, or flow that spans the mobile app and/or any backend repo.
---

# Dev Analyser — Cross-Repo Analysis

Use this skill to take any task description (bug, ticket, feature) and produce a precise, repo-specific action plan.

## Inputs accepted
- A bug description ("users can't complete checkout")
- A Jira ticket summary or description
- A feature request ("add loyalty points display to order confirmation")
- A flow description ("trace what happens when a user places an order")

## Step-by-step execution

### 1. Classify the task
Determine: is this frontend, backend, or both?
- Frontend symptoms (UI, navigation, display bugs) → start in `customer_app_2.0`
- API errors, data issues, performance → start in backend repos
- Most features touch both

### 2. Identify API endpoints involved
```bash
node -e "
  const d = require('./data/endpoints.json');
  const q = 'KEYWORD';
  const r = d.endpoints.filter(e => e.path.includes(q) || e.file.includes(q));
  r.forEach(e => console.log(e.method, e.path, '→', e.repo, e.file + ':' + e.line));
"
```
Also check `d.frontendOnlyCalls` for calls with no backend match.

### 3. For t2s-api endpoints — identify the owning module
```bash
node -e "
  const d = require('./data/api-modules.json');
  const t = d.modules['t2s-api'] || [];
  t.forEach(m => m.controllers.forEach(c => {
    if (c.name.toLowerCase().includes('KEYWORD'))
      console.log(m.name, '→', c.name, c.file, c.methods.join(', '));
  }));
"
```
This tells you which controller handles the logic and which repository/service it uses.

### 4. For frontend — identify the owning module
```bash
node -e "
  const d = require('./data/modules.json');
  const mods = d.modules['customer_app_2.0'] || [];
  mods.forEach(m => {
    const hit = m.screens.some(s => s.name.toLowerCase().includes('KEYWORD'))
             || m.components.some(c => c.name.toLowerCase().includes('KEYWORD'));
    if (hit) console.log(m.name, m.dirs.join(', '));
  });
"
```

### 5. Map endpoints to repos and files
For each endpoint found:
- Note `repo` — which backend service owns it
- Note `file` + `line` — exact location
- Note `matchedFrontendCalls` — which frontend file calls it

### 6. Read the relevant files
Open only the specific files identified above. Do NOT browse entire repos.

### 7. Produce the action plan
```
## Task: [description]

### Repos affected
- [repo name] ([technology]) — [what to change]

### Files to change
1. [repo]/[file]:[line] — [what and why]
2. [repo]/[file]:[line] — [what and why]

### API flow
[frontend file] → [method] [path] → [backend repo] [file]:[line] → [controller method]

### Notes
[edge cases, migration concerns, related endpoints]
```

## Shortcuts
- Frontend-only task (UI, styling) → go straight to `data/modules.json` (28 module groups, 217 screens)
- Backend task with known path → skip to step 5
- `foodhubglobal` tasks → completely standalone, ignore all other repos entirely

## Data sources
| File | Contains | Key fields |
|------|---------|-----------|
| `data/endpoints.json` | ~4,200 backend routes + ~178 frontend calls + ~1,426 matched | `repo`, `file`, `line`, `matchedFrontendCalls` |
| `data/modules.json` | customer_app_2.0 — 28 module groups, 217 screens | `screens`, `components`, `apiEndpoints` |
| `data/api-modules.json` | t2s-api — 21 modules, 58 controllers, 47 repos | `controllers[].methods`, `repositories`, `endpoints` |
| `config/repos.json` | repo paths and tech stack | `localPath`, `technology`, `type` |

## Known gaps (confirmed — not bugs in the scanner)

### Preorder validation across all payment types (t2s-api v2025_03_17)

Two validation types exist:
- **Slot validity** — `validateStoreStatus()` → `preOrderFutureDateValid()` (is slot within a business-day window?)
- **Expiry check** — direct `currentTime > pre_order_time - waitTime` → throws `PRE_ORDER_SHORT_TIMING`

| Route | Method | Slot validity | Expiry check (pre-payment) | Notes |
|---|---|---|---|---|
| `POST /optomany/order/{id}/payment` | `OptomanyController@payment` | ❌ | ✅ line 361 | Full check before charging |
| `POST /wallet/order/{id}/payment` | `OptomanyController@walletPayment` | ❌ | ✅ line 683 | Full check before charging |
| `POST /checkout/order/{id}/payment` | `OptomanyController@checkoutDotComPayment` | ❌ | ✅ line 1793 | Full check before charging |
| `POST /v1/cart/{id}/payment` | `CartController@newPaymentUrl` | ❌ | ✅ line 8465 | Full check before generating payment URL |
| `POST /cart/{id}/payment` | `CartController@paymentUrl` | ✅ line 8006 | ❌ | Redirect flow; expiry check runs in `confirm()` but post-payment |
| `POST /cart/{cartId}/card/{cardId}/payment` | `CartController@savedCardPaymentUrl` | ✅ line 8753 | ❌ | Slot validity only |
| `POST /cart/pay_by_link/{id}/payment` | `CartController@payByLinkPayment` | ❌ | ❌ | No preorder check at all |
| `POST /checkout/order/{id}/upi/payment` | `OptomanyController@orderUpiPayment` | ✅ line 2003 | ❌ **MISSING** | Slot validity only; `confirm($cardPayment=true)` bypasses expiry guard |

**UPI is uniquely broken:** it is the only payment type where the pre-payment expiry check is absent AND `confirm()` is called with `$cardPayment=true`, so the `!$cardPayment` guard in `CartController:4604` skips the check entirely. A customer can pay via UPI/GPay/ApplePay for a preorder whose slot has already expired.

**Fix location:** Add the expiry block in `OptomanyController@orderUpiPayment` after `validateStoreStatus()` (~line 2007), before `checkoutDotComPayment` (~line 2045). Follow the pattern at line 361 in the same file.

### Complete preorder validation gaps at payment time

`getpreorderData()` (`BusinessHour.php:226`) is the correct full check — but it is only used at the store-listing level, never in any payment endpoint.

**What a complete preorder validation requires:**
1. `store->preorder == "ENABLED"` — preorder feature on for the store
2. `pre_order_single_day` row exists for the date — business day configured
3. `getPreorderTimeDuration()` returns slots — bookable slots actually exist
4. Chosen time is a valid slot increment (`time_interval`)
5. Slot has not expired (`currentTime > pre_order_time - wait`)

**What actually runs at payment time (`preOrderFutureDateValid`, CartRepository:464):**
- Only: chosen `pre_order_time` falls within `open_at/close_at` in `pre_order_single_day` for the host + service_type

| Validation | All payment types | UPI additionally |
|---|---|---|
| Time within `pre_order_single_day` window | ✅ | ✅ |
| Service type matches | ✅ | ✅ |
| Not more than 7 days ahead | ✅ | ✅ |
| `store->preorder == "ENABLED"` | ❌ **missing** | ❌ **missing** |
| Bookable slots exist (`getPreorderTimeDuration`) | ❌ **missing** | ❌ **missing** |
| Chosen time is a valid `time_interval` slot | ❌ **missing** | ❌ **missing** |
| Slot expiry check | ✅ (card only) | ❌ **missing** |

`hasPreOrderAvailable()` (`StoreListRankingService.php:480`) is the only function that checks the store flag + first slot — it is **only used for store listing, never at payment time**.

### Authentication — cross-repo token flow

**Token creation:** t2s-api only. Laravel Passport + HS256. `JWT_KEY` env var = signing key.

**Token storage (customer_app_2.0):** Redux `userSessionState` (all platforms) + cookies (web). Expiry stored as absolute Unix timestamp. All calls via `SessionNetworkWrapper.js` inject `Authorization: Bearer <token>` + `passport: 1`. 60s pre-flight expiry check triggers silent refresh before the call.

**Token validation per service:**
| Service | How | DB lookup |
|---------|-----|-----------|
| t2s-api | Laravel Passport middleware, HS256 verify + `oauth_access_tokens` revocation check | Yes |
| falcon | `consumerJwtAuthorizer` Lambda, `jwt.verify(token, JWT_KEY)` from SSM | No (consumerJwt) / Yes (jwtRds) |
| falcon-payment-service | `jwtAuthorizer` Lambda, JWT verify + `config` table (store active) + `oauth_access_tokens` (jti) | Yes |
| t2s-mcs | Own Redis-backed auth (5-min tokens, per-session secrets). Consumer routes call `AUTH_URL` (t2s-api) | Redis |

**Shared secret:** `JWT_KEY` in AWS SSM Parameter Store — same value injected into t2s-api, falcon, falcon-payment-service. t2s-mcs is a separate trust boundary.

**Refresh:** `POST /oauth/token/refresh` (t2s-api). Triggered by error code 4012. Single-flight pattern in frontend (one refresh for all concurrent 4012s). Second 4012 after refresh = forced logout.

**Revocation:** `jti` persisted in `oauth_access_tokens` table. falcon-payment-service and `jwtRdsAuthorizer` cross-check this on every call.

**Token TTLs:** Consumer access = 14 days, refresh = 1 year.

**falcon-stats-service:** Does not exist. Stats are in t2s-api `AnalyticsController`.

Full detail: memory `auth_architecture.md` and customer-app skill § 10.

---

### t2s-api — external API access mechanisms

Five ways external systems can communicate with t2s-api:

| Mechanism | Use case | How to authenticate |
|-----------|----------|---------------------|
| **OAuth2 client_credentials** | New service-to-service integration | `POST /oauth/client` → get `client_id`+`client_secret` → `POST /v1/oauth/token` → `Authorization: Bearer <token>` + `passport: 1` |
| **License key / api_token** | Hardware terminals, POS devices, legacy | `POST /auth/management_system` with `T2S_TOKEN` → get `license_key` → pass as `?api_token=` or `Authorization: <key>` (no Bearer prefix) |
| **Super auth** | Internal service with existing Keycloak/JWT token | `POST /oauth/supper/auth` with existing JWT → exchanges for Passport token. **Internal only** |
| **MS JWT** | Internal admin/management dashboard | `POST /auth/management_system` → `authtoken:` header signed with `MS_JWT_SECRET`. **Internal only** |
| **Inbound webhooks** | Payment/SMS providers pushing events | Static token from env vars (`HOOK_API_KEY`, `REFUND_STATUS_HOOK_API_KEY`, `SMS_CALLBACK_API_KEY`) per endpoint |

**Unprotected routes** (no auth needed): `GET /`, `POST /v1/oauth/token`, `cart/*`, `menu/*`, `location/*`, `misc/*`, `oauth/*`

**Rate limits:** `POST /oauth/client` → 20/min | auth routes → 120/min | stats export → 10/24h

**Webhook endpoints:**
- `POST /hook/confirm` — card payment confirmation (`HOOK_API_KEY`)
- `POST /hook/refund` — refund status (`REFUND_STATUS_HOOK_API_KEY`)
- `POST /sms-report/callback` — SMS delivery (`SMS_CALLBACK_API_KEY`)
- `GET/POST /social/callback` — OAuth2 provider redirect
- `POST /facebook/deletion-callback` — GDPR deletion
- `GET /payment/success` — payment redirect (`?id=&transaction=` params)

**Key files:** `AuthController.php:1457` (client registration), `AuthController.php:1965` (super auth), `Authenticate.php` (middleware), `ThrottleRequests.php` (rate limits)

Full detail: memory `t2s_api_external_auth.md`.

---

### Safari `&` slug redirect — intermittent 404 (customer_app_2.0 frontend)

**Symptom:** Restaurant slug containing `&` (e.g. `pizza-&-pint`) occasionally 404s in Safari. Other browsers fine. Not reproducible locally.

**Location:** `old_code/CustomerApp/Navigation/AppNavigation.js:124-137`

**Cause:** `window.location.href` (Safari encodes `&` as `%26`) vs `window.location.pathname` (decoded `&`) mismatch. `String.replace` finds no match → navigates to `pizza-%26-pint` URL → server rewrite rule misses it → 404.

**Fix:** Replace `window.location.href = currentUrl` with `window.history.replaceState(null, '', replacedPath)` — React Navigation state is already clean from `RouterConfig.js` parse functions; only URL bar update is needed.

Full details in customer-app skill § 9 and memory `safari_ampersand_redirect_bug.md`.

---

### `GET /location/initial` — postcode `max_length: "45"` for UK

**Is this a bug?** No — intentional loose cap. Full explanation:

- `ConfigurationService.php:298` `getCountryValidation()` checks `COUNTRY_VALIDATION_ENABLED` env var
  - If **true**: reads from `country_validations` DB table (JSON blob). DB stores max_length as string `"45"` → response is `"45"` (string).
  - If **false**: falls back to `getDeafultSetup()` at line 252 → returns integer `45`.
- The `reg_ex` for UK/IE is `^[a-zA-Z0-9\s]{2,45}$` — a loose passthrough to the DB lookup.
- **Real validation** is `fusion_reg_ex` (tight UK pattern). `max_length: 45` is not a UI input limit — it's the VARCHAR column size used as a ceiling.
- US is the only country with a tight `reg_ex` (5–10 digit ZIP). All others use the loose `{2,45}` pattern.

Full detail: memory `postcode_validation.md` § t2s-api.

---

## Hard rules
- ALWAYS check `data/endpoints.json` before opening any backend file
- NEVER assume which repo owns an endpoint — always verify from scan data
- `foodhubglobal` is completely independent — never cross-reference it with other repos
- A "frontend only" call means either the endpoint is in an unscanned repo or path matching failed
- t2s-api old version dirs (`v2018_06_12` etc.) are excluded from scan — if a route is missing, check that it's in `v2025_03_17`
