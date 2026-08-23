# Verification

Verified on 2026-08-23 against VS Code 1.133.0 and rust-analyzer 0.3.3016.

## Automated

- `pnpm typecheck` — extension host, Webview, and integration-test TypeScript pass in strict mode.
- `pnpm test` — 41 unit tests cover Struct/Enum scanning, trait and generic impl association, compact graph spacing, stable graph layout, cycles, manual-position preservation, expanded-source horizontal/vertical collision reflow and restoration, hovered and pinned inspection-slot layout, target-source focus preservation, origin-source focus dismissal, long-name source-handle clamping, delayed language-hover requests, safe hover-card rendering, direction branch visibility with shared-node retention, exact-pin suppression of aggregate node hover, exclusive relationship pinning, qualified-path range narrowing and icon-free source rendering, semantic and lexical source token segmentation, comment/string exclusion, lifetime-versus-character disambiguation, raw-identifier handling, aggregate-versus-exact source endpoint selection, multiple source call sites, and header-only node dragging.
- `cargo test --manifest-path fixtures/rust-demo/Cargo.toml` — fixture compiles and its behavioral test passes.
- `pnpm test:integration` — an isolated real VS Code Extension Host activates the installed rust-analyzer, resolves the `execute` method, observes its `validate_order` and trait `submit` outgoing calls, receives hover content for the `validate_order` Call Site through `vscode.executeHoverProvider`, runs **Show Rust Call Graph**, and observes the resulting Webview tab.
- `pnpm audit --prod` — no known production dependency vulnerabilities.
- `pnpm package` — produces a 180.05 KB installable VSIX containing only the extension bundle, Webview bundle, styles, README, changelog, and license.

## Interactive Webview QA

The built-in browser demo was exercised at a 1280×720 viewport:

- Entry node, caller column, callee column, Type Node, expanded source, theme tokens, and fit controls render without overlap.
- Idle graph renders zero Edge elements.
- Entry-node hover renders its six incident relationships; moving away returns to zero.
- Hovering one source Call Site renders exactly one Edge.
- Hovering the `validate_order` Call Site moves only its target beside the expanded Entry Function; leaving restores its exact prior coordinates and emits no console warning or error.
- Active **in**/**out** controls are lower-case, icon-free, highlighted, and expose `aria-pressed="true"`.
- Toggling Entry Function **out** off reduces the visible demo from five Function Nodes to two while retaining the caller and shared Type Node; toggling it on restores five immediately from cache.
- The toolbar mark measures 0 px off-center horizontally and 0.25 px vertically after optical correction.
- Pinning `validate_order` and then `submit_order` renders only the latter edge and leaves zero previously selected React Flow nodes.
- `crate::gateway::submit_order` renders as continuous text with 0 px relationship padding/margin; only `submit_order` is interactive and no SVG/icon remains.
- After pinning `validate_order`, moving onto ordinary source inside the expanded node renders only `edge:validate`; hovering `submit_order` temporarily renders exactly those two edges and no siblings.
- After clicking `validate_order` and leaving its source range, the target remains in the first nearby inspection slot. Hovering `submit_order` adds it in a second slot without moving `validate_order`.
- Clicking `submit_order` transfers focus: `validate_order` returns to the right-hand baseline column, `submit_order` takes the first inspection slot, and only `edge:submit` remains visible. Clicking it again restores both targets to baseline.
- A synthetic function name extending 181 px beyond the Source Expansion initially placed its handle outside the visible node. After clamping, the measured overflow is 0.01 px at rest and 0 px after 260 px of horizontal scrolling.
- Scrolling far enough to reveal the long function name's end removes the clamp and returns the handle to 3.5 px past the token edge, preserving the ordinary exact-source relationship geometry.
- Hovering `validate_order` reveals `edge:validate` immediately and opens a `rust-analyzer` signature/documentation card only after the 320 ms dwell. Left-click keeps the target in its focused inspection slot while the card remains open.
- Hovering the non-relationship `Order` semantic token displays `struct Order` without adding graph edges. Leaving removes the card and token emphasis after 140 ms while an independently pinned relationship stays visible.
- With `validate_order` pinned in the nearby inspection slot, expanding its Source keeps the same x coordinate, `is-proximity-target`, and only `edge:validate`; its increased height receives a local vertical clearance adjustment. Collapsing its Source restores the prior compact dimensions without losing focus.
- Collapsing the origin `execute_order` Source clears the relationship focus and returns `validate_order` to the normal graph layout.
- Collapsed-node spacing measures 211 px horizontally and 47.47 px vertically in graph coordinates. Expanded source shifts the right column and retains a 50 px horizontal gap without overlap.
- Double-clicking the `validate_order` Call Site focuses its Function Node and exposes Back.
- Back restores the Entry Function focus and prior viewport.
- Right-clicking a node opens a keyboard-compatible context menu containing **Open Source in VS Code**.
- Computed cursor styles are `grab` on the node header, `default` on the React Flow node wrapper, node body, and signature, `text` in Source Expansion, and `pointer` on action buttons and source relationships.
- With keyword semantic tokens deliberately omitted from the demo provider data, Source Expansion still renders `pub`, `fn`, both `let` occurrences, and `crate` using the keyword class and a color distinct from ordinary source text.
- Pinning `validate_order` renders one exact edge at z-index 0, equal to the expanded node layer instead of the former z-index 20; DOM paint order keeps the routed line below Function Node UI while retaining the visible external segment and arrow.
