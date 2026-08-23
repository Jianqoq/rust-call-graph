# Verification

Verified on 2026-08-23 against VS Code 1.133.0 and rust-analyzer 0.3.3016.

## Automated

- `pnpm typecheck` — extension host, Webview, and integration-test TypeScript pass in strict mode.
- `pnpm test` — 51 unit tests cover Struct/Enum scanning, trait and generic impl association, compact shared-column layout, movable column-x preservation, cycles, bounded recent-target cell permutation, recent-history promotion/reset/deduplication, whole-column drag preview and vertical row swapping, expanded-source horizontal/vertical collision reflow and restoration, target-source focus preservation, origin-source focus dismissal, long-name source-handle clamping, delayed language-hover requests, safe hover-card rendering, direction branch visibility with shared-node retention, exact-pin suppression of aggregate node hover, exclusive relationship pinning, qualified-path range narrowing and icon-free source rendering, semantic and lexical source token segmentation, comment/string exclusion, lifetime-versus-character disambiguation, raw-identifier handling, dedicated source-theme token mapping, compact Function Node rendering without a signature summary, aggregate-versus-exact source endpoint selection, same-kind fan-out bundling and style-lane separation, multiple source call sites, and header-only node dragging.
- `cargo test --manifest-path fixtures/rust-demo/Cargo.toml` — fixture compiles and its behavioral test passes.
- `pnpm test:integration` — an isolated real VS Code Extension Host activates the installed rust-analyzer, resolves the `execute` method, observes its `validate_order` and trait `submit` outgoing calls, receives hover content for the `validate_order` Call Site through `vscode.executeHoverProvider`, runs **Show Rust Call Graph**, and observes the resulting Webview tab.
- `pnpm audit --prod` — no known production dependency vulnerabilities.
- `pnpm package` — produces a 182.81 KB installable VSIX containing only the extension bundle, Webview bundle, styles, README, changelog, and license.

## Interactive Webview QA

The built-in browser demo was exercised at a 1280×720 viewport:

- Entry node, caller column, callee column, Type Node, expanded source, theme tokens, and fit controls render without overlap.
- Idle graph renders zero Edge elements.
- Entry-node hover renders its six incident relationships; moving away returns to zero.
- Hovering one source Call Site renders exactly one Edge.
- Hovering `validate_order`, then `submit_order`, then the `audit_order` Function Reference keeps every target at x = 710 and permutes only the existing y cells `-183`, `0`, and `183`. Each newest target takes y = 0, while older targets move progressively farther.
- Leaving the expanded source after the three-hover sequence hides the temporary relationship emphasis but preserves `audit_order` at the nearest cell and the complete recent ordering.
- Active **in**/**out** controls are lower-case, icon-free, highlighted, and expose `aria-pressed="true"`.
- Toggling Entry Function **out** off reduces the visible demo from five Function Nodes to two while retaining the caller and shared Type Node; toggling it on restores five immediately from cache.
- The toolbar mark measures 0 px off-center horizontally and 0.25 px vertically after optical correction.
- Pinning `validate_order` and then `submit_order` renders only the latter edge and leaves zero previously selected React Flow nodes.
- `crate::gateway::submit_order` renders as continuous text with 0 px relationship padding/margin; only `submit_order` is interactive and no SVG/icon remains.
- After pinning `validate_order`, moving onto ordinary source inside the expanded node renders only `edge:validate`; hovering `submit_order` temporarily renders exactly those two edges and no siblings.
- After clicking `audit_order` and leaving its source range, the target remains at the nearest legal cell with `is-proximity-target`; exact-edge focus persists without moving it back.
- Clicking another source relationship transfers exact-edge focus and promotes the new target in the recent order rather than creating an additional pinned arrow.
- A synthetic function name extending 181 px beyond the Source Expansion initially placed its handle outside the visible node. After clamping, the measured overflow is 0.01 px at rest and 0 px after 260 px of horizontal scrolling.
- Scrolling far enough to reveal the long function name's end removes the clamp and returns the handle to 3.5 px past the token edge, preserving the ordinary exact-source relationship geometry.
- Hovering `validate_order` reveals `edge:validate` immediately and opens a `rust-analyzer` signature/documentation card only after the 320 ms dwell. Left-click keeps the target focused in its recent grid position while the card remains open.
- Hovering the non-relationship `Order` semantic token displays `struct Order` without adding graph edges. Leaving removes the card and token emphasis after 140 ms while an independently pinned relationship stays visible.
- With `audit_order` pinned at the nearest grid cell, expanding its Source keeps transform `translate(710px, 0px)`, `is-proximity-target`, and the exact pin; its increased dimensions use measured collision reflow without returning to its earlier ordering.
- Collapsing the origin `execute_order` Source clears the relationship focus and returns `validate_order` to the normal graph layout.
- Collapsed-node spacing measures 211 px horizontally and 47.47 px vertically in graph coordinates. Expanded source shifts the right column and retains a 50 px horizontal gap without overlap.
- Double-clicking the `validate_order` Call Site focuses its Function Node and exposes Back.
- Back restores the Entry Function focus and prior viewport.
- Right-clicking a node opens a keyboard-compatible context menu containing **Open Source in VS Code**.
- Computed cursor styles are `grab` on the node header, `default` on the React Flow node wrapper, node body, and signature, `text` in Source Expansion, and `pointer` on action buttons and source relationships.
- With `validate_order` focused/pinned at y = 0, dragging it downward finishes at `translate(710px, 183px)` while `audit_order` swaps into y = 0; `is-proximity-target` and the exact pin remain active.
- Dragging that focused node horizontally then moves `validate_order`, `submit_order`, and `audit_order` together from x = 710 to x = 810 while preserving their `183`, `-183`, and `0` rows; `route_order` remains at x = -549.
- React Flow's final `dragging:false` position event is normalized to the completed grid result instead of overwriting the row swap with a free-form coordinate.
- With keyword semantic tokens deliberately omitted from the demo provider data, Source Expansion still renders `pub`, `fn`, both `let` occurrences, and `crate` using the keyword class and a color distinct from ordinary source text.
- Pinning `validate_order` renders one exact edge at z-index 0, equal to the expanded node layer instead of the former z-index 20; DOM paint order keeps the routed line below Function Node UI while retaining the visible external segment and arrow.
- Pinning the Entry Function's aggregate relationships renders the three outgoing Call Edges through exactly one shared solid trunk, with an independent branch and arrowhead for `validate_order`, `submit_order`, and `audit_order`. The Function Reference uses one adjacent dashed trunk rather than overpainting the Call lane.
- Clicking the exact `validate_order` Call Site renders one ordinary source-range path and zero shared trunks, preserving exact source anchoring.
- All five demo Function Nodes render without `.node-signature`; a collapsed node keeps exactly **in**, **Source**, and **out**, while the expanded Entry Function still renders its complete Source Expansion.
- Under the reported theme condition where editor text and `symbolIcon.keywordForeground` are both `rgb(212, 212, 212)`, the dedicated source palette renders keywords as `rgb(197, 134, 192)`. The complete demo exposes four visibly distinct token colors across keywords, functions, types, variables, and enum members.
