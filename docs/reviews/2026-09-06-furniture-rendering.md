# Furniture appearance and model lifecycle

Issue #61 repairs the asynchronous GLB path used by the web catalog and 3D viewer. Explicit item colors tint the loaded asset while retaining its original texture and contrasting details. The existing material choices now adjust roughness, metalness and, for Glass, opacity. The unset choice is shown as **Original materials**; unknown stored choices remain retained. Reset to defaults clears overrides. This does not introduce physically accurate material simulation or a native rendering change.

Placement ghosts keep their blue translucent appearance before and after a model loads. Each thumbnail and placed instance owns cloned geometry, materials and textures; removing a thumbnail, rebuilding a floor, cancelling placement or leaving 3D disposes the instance without damaging the cached template or another item. Late model completions cannot revive disposed containers. Invalid model dimensions and failed loads leave the original procedural fallback intact.

Thumbnails and placed furniture use one catalog mapping and share in-flight/template loads for each bundled file. Nothing is fetched before it is needed. Templates are retained for the browser page session; failures also remain cached until reload to avoid repeated requests on every edit. Existing content-hashed, immutable asset URLs remain in use. The fireplace uses its procedural fireplace rather than the unrelated toaster GLB. No asset files, external model service, production dependency or Firebase upload is added.

Wall transparency now affects active-floor wall bodies. Furniture finishes, glass openings, floor surfaces and the already-translucent reference floors keep their own settings. The wall setting is reapplied when the scene rebuilds.

Validation covers independent cached instances, shared textures, single-request reuse, fractional model bounds, tint/finish preservation, delayed disposal, invalid models and failed-request suppression. Production-browser CI exercises desktop/390px rendering using actual pixel colors, editing and persisted finishes, catalog reuse, repeated 2D/3D transitions, and completion after 3D closes. The PR records final test counts and live release verification.

Native furniture categories/rendering and broader catalog parity remain subsequent work. Issue #30 still tracks native distribution, physical-device transfer and Firebase migration/billing gates.
