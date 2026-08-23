# Rust Call Graph product specification

## Product boundary

Rust Call Graph is an independent, general-purpose VS Code extension for exploring Rust source. It has no runtime, package, or domain dependency on Northstar Trading or any other host repository.

The first release targets desktop VS Code and workspace extension hosts used by Remote SSH and WSL. It produces a locally installable VSIX. Browser-only `vscode.dev` and Marketplace publication are outside the first release.

## Entry and analysis

- A Rust editor context-menu command named **Show Rust Call Graph** analyzes the function or method under the cursor.
- The command remains visible for Rust editors. Invoking it outside a supported function reports a bounded explanation instead of opening an empty graph.
- The active VS Code Rust language provider, normally rust-analyzer, is the semantic authority for function identity, definitions, calls, references, and source ranges.
- The extension and graph UI are TypeScript. They do not embed a Rust compiler or start another language server.
- The initial graph contains the Entry Function, its direct incoming callers, direct outgoing callees, and source-backed Function References.

## Graph model

- Supported Function Nodes are free functions, implementation methods, trait declarations, and trait default methods.
- A generic function has one Function Node for its source definition; monomorphized instances are not separate nodes.
- Closures are not independent nodes in the first release.
- Struct and Enum definitions are Type Nodes. A Type Node can reveal its associated functions and methods as independent Function Nodes.
- Enum variants are listed inside their Enum Node and are not independent graph nodes.
- A Call Edge points from caller to callee. A Reference Edge points from the referencing function to the referenced function and is visually distinct.
- Dynamic trait calls point to the trait method returned by the language provider; the extension does not invent a set of possible runtime implementations.
- Macro-produced relationships appear only when the language provider maps them to a real source range.
- A source-defined function has one node per definition URI and selection range. Recursion uses a self-edge, and longer cycles reuse the existing nodes.

## Progressive exploration

- The first layout places incoming callers to the left, the Entry Function in the center, and outgoing calls/references to the right.
- Collapsed-node horizontal and vertical whitespace is half the original layout spacing. Node dimensions and typography do not shrink.
- Every Function Node has lower-case, text-only **in** and **out** direction toggles. The first click resolves and shows all direct relationships in that direction up to the graph limit; the active button is highlighted. A second click removes that direction's branch from the canvas, and another click restores the cached branch immediately.
- A collapsed Function Node contains its Function/name header and **in**/**Source**/**out** actions without a separate signature-summary row. Full source text remains available through Source Expansion.
- Removing a branch retains any node that remains reachable through another visible relationship, preventing shared and cyclic nodes from disappearing incorrectly.
- Existing nodes keep their baseline positions. Expanding source temporarily pushes overlapping nodes and compact right-hand columns aside using the measured expanded size; collapsing source restores the vacated space. User-dragged baseline positions are never overwritten by later relationship expansion or refresh.
- Nodes are draggable only from their header. The remaining node surface uses the default cursor, selectable Source Expansion uses the text cursor, and controls and source relationships use the pointer cursor.
- Struct and Enum association expansion admits at most 50 new Function Nodes at a time and exposes **Load more** when additional methods exist.
- The default graph limit is 250 nodes and is configurable.
- Standard-library and Cargo-dependency functions appear as dimmed leaf nodes by default.
- **Include Dependencies** allows expansion of external nodes whose source is available. Unavailable definitions are explicitly labelled.

## Relationship visibility

- The idle graph has no visible arrows.
- Hovering a node reveals all incident Call and Reference Edges.
- Selecting a node pins its incident edges. Selecting a source relationship pins only that exact edge; selecting a different source relationship replaces the prior pinned edge and clears the prior graph-node selection. Selecting the same relationship again or pressing `Escape` dismisses it.
- While an exact source relationship is pinned, aggregate Function Node hover is suppressed. Its target remains in the nearby inspection slot after pointer leave. Hovering another exact source relationship temporarily adds that edge and a second inspection slot without moving the pinned target.
- Expanding or collapsing Source on the pinned target preserves the exact edge and inspection slot while reflowing for the target's measured size. Collapsing the origin Source dismisses the pin because its Call Site or Function Reference is no longer visible.
- An expanded Function Node shows the complete read-only source definition.
- Every source-backed Call Site and Function Reference has a rectangular highlight.
- When a provider reports a qualified Rust path such as `std::fs::read_to_string`, the path remains continuously typeset and only the terminal function identifier is highlighted. Source relationships contain no inline jump icon or icon spacing.
- Hovering a highlighted source range reveals only its exact edge to the target Function Node.
- An exact source endpoint follows the function name while its right edge is visible. If a long function name extends beyond the Source Expansion viewport, the endpoint is clamped to the visible right boundary and is recalculated during horizontal scrolling.
- Exact source edges render below Function Nodes. Scrolling continues to update the exact source endpoint, but the routed line remains visually occluded by Source Expansion and node controls until it exits the node boundary.
- While a Call Site or Function Reference is hovered, its target Function Node temporarily moves into a collision-free inspection slot beside the expanded source node. Leaving restores the layout unless the relationship is pinned; a pinned target holds the first inspection slot until dismissed or replaced, while a distinct hover uses the next slot.
- Source Expansion does not change aggregate node-edge geometry: node hover or node pin routes every incident edge through the Function Node's right-side endpoint. Hovering or pinning an exact Call Site or Function Reference temporarily routes only that edge through its source-range endpoint.
- Source syntax uses rust-analyzer semantic tokens and current VS Code theme colors. A local lexical fallback colors Rust keywords, booleans, numbers, strings, character literals, comments, and lifetimes when the provider omits those ranges; overlapping provider tokens remain authoritative. The fallback never resolves program identity or relationships. The initial viewport maintains a readable zoom floor; **Fit** remains available for a complete overview.
- Pausing over a semantic source token requests hover information from the active VS Code language provider at the token's real workspace URI and position. Rust signatures and documentation appear in a delayed, theme-aware, non-executable hover card.
- Language hover is additive. A source relationship continues to reveal its exact edge immediately, and left-click continues to focus that relationship and its target Function Node.

## Navigation

- Double-clicking a highlighted Call Site or Function Reference changes Graph Focus to its target node without opening an editor.
- Following a relationship records the origin node and viewport as a Return Point.
- The focused target node displays a **Back** button. Activating it restores the prior Graph Focus and viewport; repeated navigation forms a stack.
- Right-clicking any graph node opens an accessible context menu.
- **Open Source in VS Code** opens the node's definition in a normal text editor and selects its definition name.
- Double-clicking a graph node is reserved for graph focus and does not replace the explicit editor-opening command.

## Refresh and state

- Changes to Rust documents already represented in the graph trigger a 600 ms debounced reanalysis.
- Reanalysis preserves source expansion, relationship expansion, pinned relationships, navigation history, viewport, and manual positions whenever their source identities still exist.
- A toolbar **Refresh** command performs the same reconciliation immediately.
- Removed or no-longer-resolvable nodes disappear with a non-blocking status announcement.

## Accessibility and theme

- The Webview uses VS Code semantic color and typography variables and remains legible in light, dark, and high-contrast themes.
- Nodes, expansion controls, source relationships, the toolbar, and context menus are keyboard reachable and have visible focus indicators.
- Context menus support arrow-key navigation, `Enter`/`Space`, and `Escape`.
- Dynamic loading, errors, node counts, focus changes, and truncation are exposed through polite live-region announcements.
- Motion honors `prefers-reduced-motion`; graph meaning never depends on color alone.

## Acceptance criteria

1. From a Rust function, **Show Rust Call Graph** opens an editor-area Webview with that function centered and its direct callers/callees around it.
2. A function with two calls to the same target has two independently hoverable source highlights that both resolve to the single target node.
3. No arrows are rendered at rest; node hover, source-range hover, pinning, and `Escape` produce the specified visibility states.
4. Expanding source preserves exact text and makes every reported relationship range interactive.
5. Double-clicking a source relationship focuses the existing target node, and **Back** restores the previous node and viewport.
6. Node right-click → **Open Source in VS Code** opens the correct URI and selects the definition.
7. Direct recursion and a two-function cycle never duplicate Function Nodes.
8. Struct and Enum Type Nodes reveal their associated functions; Enum variants remain labels rather than nodes.
9. An edit to a represented Rust function refreshes its relationships without losing manual node positions or expanded source.
10. Limits, dependency leaves, missing source, provider absence, cancellation, and non-function invocation fail visibly without leaving a misleading partial graph.
11. The extension compiles, passes unit and integration tests, and packages as an installable VSIX.
12. **in**/**out** are icon-free toggles whose visual highlight and `aria-pressed` state agree; toggling off removes only that direction's canvas branch and toggling on restores it.
13. Hovering a source relationship moves only its target node into the nearby inspection slot, and mouse leave restores the prior layout exactly.
14. With a source relationship pinned, moving onto the surrounding expanded Function Node leaves only the exact pinned edge visible; an exact hover may add one temporary edge but unrelated node edges remain hidden.
15. Collapsed-node whitespace is reduced by half, and an expanded source node creates collision-free horizontal room without changing persisted baseline positions.
16. Clicking a source relationship keeps its target in the nearby inspection slot after mouse leave; hovering a second relationship adds a temporary second slot, and dismissing or replacing focus restores the displaced target.
17. A source relationship whose function name exceeds the Source Expansion width never places its edge endpoint outside the visible source boundary, including before and after horizontal scrolling.
18. Hovering a semantic source token displays the active Rust language provider's signature/documentation without changing Graph Focus; relationship hover and left-click keep their graph behavior while that information is available.
19. Expanding or collapsing Source on a relationship-focused target does not return it to its baseline column; hiding the origin Source clears the relationship focus.
20. Hovering a node body never presents a drag cursor; dragging begins only from its header, while expanded source remains text-selectable and interactive elements retain a pointer cursor.
21. Scrolling a pinned source relationship updates its exact endpoint without drawing the edge above Source Expansion, action buttons, or any other Function Node surface.
22. Rust keywords and lexical literals receive theme-aware syntax color even when the active semantic provider omits those token ranges, without overriding overlapping semantic tokens.
23. Function Nodes do not render a signature-summary row between the header and actions; the function name, navigation controls, direction controls, and Source Expansion remain available.
