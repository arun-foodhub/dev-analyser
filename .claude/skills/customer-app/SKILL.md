---
name: customer-app
description: Use when working on anything in customer_app_2.0 — debugging a screen, tracing an API call from the dashboard to source code, adding a feature, or understanding the module/saga structure. Bridges dev-analyser dashboard data to the actual repo layout.
---

# Working with customer_app_2.0

Path: `/Users/arun/Desktop/Workspace/customer_app_2.0`

**All active development is in `old_code/`.** `packages/` is a migration target, not production.

---

## 1. Starting from a dashboard module

When the dev-analyser **App Modules** page shows a module (e.g. "Cart & Checkout"), map it to code:

```
Dashboard category → old_code/AppModules/<ModuleName>/
```

Inside each module:
```
Action/    → action creators + type constants
Saga/      → side effects, API calls, business logic
Reducer/   → state slice
Network/   → HTTP call definitions {method, url}
View/      → screens + components
Library/   → facade wrappers (never import SDK directly)
```

Before opening any file, check `.memory/core/MODULE_CATALOG.md` or `.memory/playbook/modules/INDEX.md` — they list exact file paths per module so you don't grep blind.

---

## 2. Tracing a frontend API call to source

When you see an API endpoint on the **Customer App → Endpoints** dashboard page:

### Step 1 — look up in dev-analyser data
```bash
node -e "
  const d = require('./data/endpoints.json');
  const hits = d.endpoints.filter(e => e.path.includes('KEYWORD') && e.matchedFrontendCalls.length);
  hits.forEach(e => {
    console.log(e.method, e.path);
    e.matchedFrontendCalls.forEach(fc => console.log('  ↳', fc.file + ':' + fc.line, fc.rawCall));
  });
"
```

### Step 2 — find the Network object in the module
The matched `file` from step 1 is the Network file. Open it to see the full request shape:
```
old_code/AppModules/<Module>/Network/<Module>Network.js
```

### Step 3 — find the saga that calls it
Check `.memory/api-integration/API_ENDPOINTS.json` for the endpoint — it shows which saga/action triggers the call.
Or check `.memory/WHERE_TO_LOOK.json` for the domain.

### Step 4 — find the screen that triggers the saga
Check `.memory/NAVIGATION_MAP.json` for the route → screen mapping.
Check `.memory/features/<feature>.md` for the end-to-end flow.

---

## 3. Adding a new feature

### If adding to old_code (fix/patch):
Follow the existing module pattern exactly:
1. Add action types to `<Module>/Action/<Module>Types.js`
2. Add action creators to `<Module>/Action/<Module>Actions.js`
3. Add saga worker + watcher to `<Module>/Saga/<Module>Saga.js`
4. Add network object to `<Module>/Network/<Module>Network.js` — `{ method: NETWORK_METHOD.POST, url: '/consumer/v1/...' }`
5. Update reducer in `<Module>/Reducer/<Module>Reducer.js`
6. Update view — UI only, no logic in components

### If adding to packages/ (new feature):
```
packages/features/feature-<name>/
├── View/[Feature]View.tsx          UI only
├── redux/
│   ├── [Feature]Types.ts           action type constants
│   ├── [Feature]Actions.ts         function-based creators
│   ├── [Feature]Slices.ts          createSlice + extraReducers
│   ├── [Feature]Selector.ts        selectors
│   └── [Feature]Saga.ts            side effects
└── register.ts                     registers reducer + saga
```

Redux rules (both old_code and packages):
- Function-based action creators, NEVER `createAction` from RTK
- State interface in the Slices file, not Types
- `extraReducers` only, never export `slice.actions`
- Tests: `expectSaga` from redux-saga-test-plan — no gen.next() stepping

---

## 4. Cross-platform check

Code runs on iOS, Android, web (webpack), and Next.js. Before calling done:

- No `Platform.OS === 'web'` in component bodies — use facade or `GlobalAppHelperPlatform` helpers
- Native SDK imports must go through `Library/SupportLibrary.js` + `Library/SupportLibrary.web.js` facades
- Test on both: `pnpm ios` (mobile) and `pnpm caweb` (web build)
- React Navigation **v6** only in old_code — do NOT use v7 APIs

---

## 5. Doc-first navigation (mandatory before grepping old_code)

| What you need | Where to look first |
|--------------|-------------------|
| Saga for an action | `.memory/state-management/SAGAS_CATALOG.json` |
| Which files handle an order type / flow | `.memory/WHERE_TO_LOOK.json` |
| API endpoint details | `.memory/api-integration/API_ENDPOINTS.json` |
| Module → file list | `.memory/core/MODULE_CATALOG.md` |
| Route → screen | `.memory/NAVIGATION_MAP.json` |
| Known bugs | `.memory/quality/FAILURE_CATALOG.md` |
| Feature flow docs | `.memory/features/*.md` |

Entry points: `.memory/INDEX.md` → `.memory/RETRIEVAL_MAP.json` (keyword → doc)

---

## 6. Using the repo's built-in agents

From the customer_app_2.0 repo, Claude has access to these subagents:

| Agent | Use it for |
|-------|-----------|
| `old-code-navigator` | Locating files in old_code/ without grepping — returns paths + line refs, read-only |
| `redux-saga-expert` | Writing/modifying any Redux or Saga code |
| `rn-test-writer` | Adding Jest test coverage |
| `nx-boundary-enforcer` | Validating module boundary compliance before merging |

---

## 7. Commands reference

```bash
pnpm ios / pnpm android          # Run CustomerApp on device/simulator
pnpm fi  / pnpm fa               # Run Foodhub mobile
pnpm caweb                       # CustomerApp web (old_code webpack build)
pnpm lint:fix                    # ESLint auto-fix
pnpm test                        # All Jest tests
pnpm nx test feature-<name>      # Single package tests
cd old_code && pnpm test         # old_code Jest tests
pnpm nx graph                    # Nx dependency visualisation
```

---

## 8. Fraud Prevention SDKs (Risk SDK + Kount SDK)

Checkout.com fraud prevention layer. Only active when store uses Checkout gateway AND both feature flags are on.

### Feature flags
- `selectEnableFraudPreventionSDK` → `state.appConfiguratorState.enable_fraud_prevention_sdk`
- `selectEnableRiskSDK` → `state.appConfiguratorState.enable_risk_sdk`

### Key files
```
old_code/AppModules/PaymentModule/Utils/
├── RiskSDKHelper.{android,ios,web}.js   — facade per platform
├── KountSDKHelper.{android,ios,web}.js  — facade per platform
└── PaymentGatewayConfig.js              — public keys, kountMerchantId

old_code/AppModules/BasketModule/Redux/BasketSaga.js:2715  — initKountSDK() saga
old_code/CustomerApp/Saga/AppSaga.js:187                   — spawn at app init
old_code/AppModules/QuickCheckoutModule/Utils/PaymentHelper.js:854  — risk data assembly
```

### When SDKs initialize
1. **App launch** — `AppSaga.js:187` spawns `initKountSDK()` (async, non-blocking)
2. **Store selection** — `BasketSaga.js:2832` spawns `initKountSDK()` again inside `getPaymentProviderForStoreCall()`

### Web vs Mobile differences
| SDK | Mobile | Web |
|-----|--------|-----|
| Risk | Native `CheckoutRiskSDK.initialize(publicKey, isProd)` | CDN script load → `window.Risk.create(publicKey)` |
| Kount | Native `KountSDK.initializeKount(merchantId, isProd)` | **No-op init**; collection deferred to `getKountDeviceSessionId()` |

### Data gathered at payment time (PaymentHelper.js:854)
```js
riskData = {
  device_session_id: riskInstance.publishRiskData(),     // Risk SDK session ID (web)
  k_device_session_id: kountSDK(config, deviceID).sessionID,
  device: {
    user_agent, network: { ipv4, tor, vpn, proxy },
    provider: { id, name, timestamp, timezone },
    virtual_machine, incognito, java_enabled, language
  }
}
```

### API calls triggered from frontend
- `GET https://foodhub.co.uk/api/misc/ip` — IP lookup in `getSDKDeviceInfo()` at payment time (not at init)
- Checkout CDN script loaded by web Risk SDK init: `risk.checkout.com/cdn/risk/2.1/risk.js`

### Config values (PaymentGatewayConfig.js)
- Risk prod public key: `pk_yxda2co3fvfazmbpmobhzcf6uaj`
- Risk sandbox key: `pk_sbox_qpravplcrp3k75nth65diubfiim`
- Kount merchant ID: `100307`
- `commonConfig.isSandBox = true` currently — check `isNonProd()` if prod fingerprinting seems wrong

---

## 9. Known URL Routing Bugs

### Safari `&` in slug → intermittent 404

**Symptom:** `pizza-&-pint` URL occasionally 404s in Safari only. `pizza-and-pint` and `pizza-pint` always work. Not reproducible locally — server only, occasional.

**Root cause:** Two-layer encoding mismatch.
- `window.location.pathname` → decoded `pizza-&-pint`
- `window.location.href` → Safari percent-encodes to `pizza-%26-pint`

In `AppNavigation.js:131`, `currentUrl.replace(currentPath, replacedPath)` finds **no match** (searching `&` inside a string that has `%26`). So `window.location.href` navigates to the `%26` URL, which the server's rewrite rule doesn't match → 404.

**Race condition:** The `useEffect([routeNameChange])` and React Navigation's own `history.replaceState` both run on init. Their order is non-deterministic, making the bug intermittent.

**Files involved:**

| File | Lines | Role |
|------|-------|------|
| `old_code/CustomerApp/Navigation/AppNavigation.js` | 124–137 | Bug — `useEffect` that hard-redirects |
| `old_code/CustomerApp/Navigation/AppNavigation.js` | 384 | `setRouteNameChange` that triggers the effect |
| `old_code/AppModules/RouterModule/Utils/RouterConfig.js` | 15–26 | Layer 1 parse — already cleans slug correctly (not the bug) |
| `old_code/FoodHubApp/TakeawayListModule/Utils/Helper.js` | 2083–2107 | `cleanSpecialCharForSeo` — `&` → `and` conversion |
| `old_code/T2SBaseModule/Utils/helpers.js` | 1468–1477 | `seoFriendlyUrl` — calls `cleanSpecialCharForSeo` |
| `old_code/AppModules/RouterModule/Utils/Constants.js` | 89–100 | `seoFriendlyRouteName` — routes that trigger the check |

**Fix (`AppNavigation.js:129-134`):**
```js
// BEFORE (buggy):
let currentUrl = window?.location?.href || '';
const replacedPath = seoFriendlyUrl(currentPath);
currentUrl = currentUrl.replace(currentPath, replacedPath);
if (currentPath !== replacedPath) {
    window.location.href = currentUrl;   // hard reload + encoding mismatch
}

// AFTER (fix):
const replacedPath = seoFriendlyUrl(currentPath);
if (currentPath !== replacedPath) {
    window.history.replaceState(null, '', replacedPath);  // URL bar only, no reload
}
```

`RouterConfig.js` parse functions already clean the React Navigation internal state. Only the URL bar needs updating — no page reload required. `replaceWindowRoute` elsewhere already uses `history.replaceState` correctly.

**Secondary smell:** `old_code/FoodHubApp/TakeawayListModule/Utils/Helper.js:2096-2099` — after `replace(/&/g, 'and')`, the next regex `[^a-zA-Z0-9\-\/&:.#]+` still allows `&` through. Harmless today but fragile.

---

## 10. Authentication System

### How tokens are created and stored

**Login** calls `POST /consumer/login` (or OTP/social variants) in `AuthNetwork.js`. Password is **MD5-hashed client-side** before sending.

Response `{ access_token, refresh_token, token_type: "Bearer", access_expires_in, refresh_expires_in }` is stored in:
- **Redux** (`userSessionState`) — source of truth on all platforms
- **Cookies** (web only via `CookiesHelper.web.js`) — `CookiesHelper.js` is a no-op stub on native

TTL values from the API are converted to **absolute Unix timestamps** immediately via `addTimeDeviceMoment(ttl_seconds)`.

**Key selectors** (`SessionManagerSelectors.js`):
```js
selectUserAccessToken          → raw access_token string
selectRefreshToken             → raw refresh_token string
selectUserAccessTokenExpires   → absolute expiry timestamp
getAccessTokenWithTokenType    → "Bearer <token>" (for Authorization header)
```

### How tokens are attached to requests

All API calls go through `SessionNetworkWrapper.js`. `addJWTToRequest()` adds:
```
Authorization: Bearer <access_token>
passport: 1
```
**60-second pre-flight expiry check** — if `access_token_expires_in < now + 60s`, it silently refreshes before making the call.

To skip auth on a specific call: set `isAccessTokenRequired: false` in the network config object.

### Refresh token flow

Triggered by error code **4012** (`UNAUTHORIZED_ACCESS`) from any backend service:
1. `POST /oauth/token/refresh` with `{ refresh_token }` body + current `Authorization` header
2. Redux and cookies updated with new token pair
3. Original failed request is retried with new token
4. If 4012 again after refresh → **forced logout** (`PERSISTENT_401_AFTER_REFRESH`)

**Single-flight** — only one refresh in flight at a time. Concurrent 4012s all wait for the same refresh result.

**Error code reference:**
| Code | Action |
|------|--------|
| 4011 | Force logout |
| 4012 | Trigger refresh → retry |
| 4013 | Force logout |
| 4014 | Force logout |
| 4016 | Force logout + show banned message |

### How downstream services validate the token

The frontend sends the same `Authorization: Bearer <token>` to every service. Each validates it differently:

| Service | Validation method |
|---------|-----------------|
| **t2s-api** | Laravel Passport middleware — verify HS256 signature + check `jti` in `oauth_access_tokens` table (revoked=0) |
| **falcon** | AWS API Gateway `consumerJwtAuthorizer` Lambda — `jwt.verify(token, JWT_KEY)` locally, no DB call |
| **falcon-payment-service** | `jwtAuthorizer` Lambda — JWT verify + DB check on `config` table (store active) + `oauth_access_tokens` (jti exists) |
| **t2s-mcs** | Own Redis-backed auth (5-min tokens, per-session secrets). For consumer routes: calls `AUTH_URL` (t2s-api) to validate |

All of t2s-api, falcon, falcon-payment-service share the **same `JWT_KEY`** (from AWS SSM Parameter Store). t2s-mcs is a completely separate trust boundary.

### Social login

All providers call `POST /consumer/social/login` (or `/v2`, `/v3`) with `{ type, token }`. The backend exchanges the provider token for the standard `access_token + refresh_token` pair — no provider tokens are stored in the app after that.

| Provider | Package | What's sent to backend |
|----------|---------|----------------------|
| Google | `@react-native-google-signin` | `accessToken` from `GoogleSignin.getTokens()` |
| Facebook | `react-native-facebook-sdk` | `AccessToken` from `AccessToken.getCurrentAccessToken()` |
| Apple | `@react-native-apple-authentication` | `authorizationCode` from `appleAuth.performRequest()` |
| Microsoft | `react-native-app-auth` | token from `AuthManager.signInAsync()` |

### External systems calling t2s-api (non-frontend)

When the task involves a third-party or service-to-service integration (not the customer app), the mechanisms differ from the consumer Bearer token flow:

| Caller type | Mechanism | Key header/param |
|-------------|-----------|-----------------|
| External service (new) | OAuth2 `client_credentials` — `POST /oauth/client` then `POST /v1/oauth/token` | `Authorization: Bearer <token>` + `passport: 1` |
| POS / hardware terminal | License key — `md5(contact_no+host+app_name)` | `?api_token=<key>` or `Authorization: <key>` (no Bearer) |
| Internal cross-service | Super auth — `POST /oauth/supper/auth` exchanges any JWT for Passport token | Same Bearer pattern |
| Payment/SMS providers | Inbound webhooks — static env-var tokens per endpoint | `HOOK_API_KEY`, `REFUND_STATUS_HOOK_API_KEY`, etc. |

Unprotected routes any caller can hit without auth: `cart/*`, `menu/*`, `location/*`, `misc/*`.

Full detail: memory `t2s_api_external_auth.md` and analyse skill § t2s-api external access.

---

### Guest users

`authState.guestUser` boolean tracks guest state. Guest tokens stored in `guestUserToken` / `guestUserTokenFromRoute`. On successful login: `RESET_GUEST_USER` action clears the guest state.

---

## Key constraints (call these out in code review)

- `old_code/` — no refactors, no restructuring; fixes and features only
- Navigation in old_code: React Navigation **v6 native stack** exclusively
- No direct SDK imports in feature code — always use a `Library/` facade
- `takeLatest` cancels the generator but NOT the HTTP request in-flight
- Action type strings must be identical between saga watchers and reducer `addCase` — bugs hide here when constants are imported from different objects
- Verify cross-platform before declaring done — don't claim success if you haven't run the web build
