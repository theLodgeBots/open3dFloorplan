# Direct AI providers — 2026-09-06

## Scope and contributor integration

Integrates the provider configuration and model-discovery work from community PR
[#14](https://github.com/laanlabs/openPlan3D/pull/14), retaining its commit ancestry.
The proposed anonymous arbitrary-destination server proxy is removed before merge.
There is no `/api/openai-proxy` route or fallback. Browser requests go directly to
the provider selected by the user; no service, database, bucket write, image
retention, or AI traffic through Firebase/App Hosting is added.

## User behavior

- Settings → AI configures a provider base URL, optional key, and a model ID.
  Model suggestions support typing/search and manual values. Load models is an
  explicit request; opening settings, switching provider tabs, and reloading do
  not send credentials. Discovery never silently selects the first listed model.
- Changing the destination clears the draft key and model. Saving writes the
  destination/key/model together, migrates the old browser keys, and reports
  storage failures. Remove clears both new and legacy settings. None of these
  values enter project files or exports.
- The interior camera render panel displays the destination, supports manual model
  changes and explicit refresh, and uses saved settings immediately.
- Corrects the existing `gpt-image-1` Responses model default to `gpt-4.1` (already
  present in the old picker). The Responses image tool needs a text model in its
  top-level model field. GPT Image models are rejected there for api.openai.com.
  See [OpenAI's image-generation tool documentation](https://developers.openai.com/api/docs/guides/tools-image-generation).
- Rendering requests PNG output, forces the image tool, and sets `store: false`.
  This does not promise zero provider-side retention; provider policies still apply.
- Missing keys, incompatible responses, HTTP errors, CORS/network failures, and
  cancellation appear inline. Cancel, closing the camera, changing floors, provider
  changes, and leaving 3D prevent late responses from replacing the current result.

## Transport and costs

Only absolute HTTPS destinations or HTTP loopback (`localhost`, `127.0.0.1`, `[::1]`)
are accepted. URL credentials, query strings, and fragments are rejected. Browser
cookies/referrers are omitted and redirects fail rather than forwarding requests.
The current app origin is rejected as a provider. Discovery times out after 30s;
rendering after 180s, including response-body reads. Responses are bounded to 1 MiB
for models and 24 MiB for images. Failed paid requests are never automatically
retried. Provider response bodies are not copied into errors, since they can echo
credentials or submitted images. Cancellation cannot reverse work already started
at a provider or guarantee that it will not charge.

Custom providers must allow browser CORS and implement Responses with the
`image_generation` tool. A generic chat-only endpoint is insufficient. Listed
models are not certified as image-capable. HTTP loopback and local network access
also depend on browser permissions. `localhost` refers to the user's computer.
CORS-restricted providers need configuration or a user-operated service; the public
app does not supply a proxy.

## Validation

256 unit tests pass, including direct request shape, invalid destinations,
keyless providers, bounded/malformed responses, timeout/cancellation, no retry,
legacy migration, removal, and failure-safe settings writes. Svelte check reports
0 errors and 24 pre-existing warnings; production build succeeds.

Added production browser workflows at 1440px and 390px for settings, destination
credential clearing, model discovery and stale-request cancellation, manual IDs,
reload persistence, HTTP failure, real Three.js camera capture, response display,
PNG download byte equality, unsupported images, cancellation, removal, and no
hosting POSTs. A local HTTP provider echoes the captured camera PNG; it never
calls an AI service. No paid image generation or real provider account access is
claimed by these tests. Existing project/floor/cache workflows remain in CI.

Issue #30 remains open for the iPhone release/legacy-rule migration and billing
budget administration. This batch changes neither Storage rules nor iOS clients.

Interactive production-build checks also verified the settings and camera panel at
390px, manual-model persistence, image display/download, and cancellation. The
camera panel now stays above the 3D toolbar so controls do not overlap its content.
