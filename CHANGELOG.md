# Changelog

## 0.1.17

- Aggregate fan-out Call Edges now share one rendered trunk per source and target column, eliminating the dark/bright bands caused by identical SVG segments being painted repeatedly.
- Every relationship keeps its own target branch and arrowhead, while Call and Reference Edges use separate solid and dashed bundle lanes so their meanings remain distinct.
- Exact Call Site and Function Reference interactions remain unbundled and continue to originate at the highlighted source identifier.

## 0.1.16

- Horizontal node dragging now translates the entire originating grid column, including every node and row cell in it.
- Vertical dragging swaps the selected node with the nearest legal row occupant while preserving focus and exact relationship pinning.
- Drag start commits the visible recent-target ordering before manual movement, so automatic recency no longer pulls a focused node back to its prior cell.
- React Flow's trailing `dragging:false` position update now inherits the completed grid coordinates instead of restoring a free-form expanded-source offset.

## 0.1.15

- Function and Type Nodes now occupy fixed rank columns and bounded vertical grid cells instead of free-form inspection coordinates.
- Hovering or selecting a source relationship promotes its target to the nearest cell; previously inspected targets move progressively farther in recent-access order and retain that order after pointer leave.
- Header dragging is constrained to the current column and its outer rows, then snaps the reordered column back onto valid cells at release.
- Corrected React Flow node extents to include node dimensions, preventing expanded nodes from being shifted left by their own width.

## 0.1.14

- Source Expansion no longer uses Explorer symbol-icon colors for Rust syntax tokens; themes can legitimately make those colors identical to ordinary editor text.
- Added a dedicated, theme-aware source palette for visibly distinct keywords, functions, types, variables, strings, numbers, comments, attributes, and literals.

## 0.1.13

- Removed the redundant function signature summary between the Function Node header and its **in**/**Source**/**out** controls.
- Function Nodes now keep their compact header and actions; the full signature remains available in expanded Source and normal VS Code language hover.

## 0.1.12

- Pinned and hovered source edges now render below Function Nodes, so scrolling keeps their exact endpoint aligned without drawing the routed line over Source Expansion, node actions, or other node UI.
- Source Expansion now supplements rust-analyzer semantic tokens with a Rust lexical color fallback for keywords, booleans, numbers, strings, comments, lifetimes, and character literals that the provider omits.
- Provider semantic tokens remain authoritative wherever they overlap the lexical fallback.

## 0.1.11

- Node dragging is now limited to the node header instead of turning every hovered node surface into a drag affordance.
- Node bodies use the default cursor, expanded source uses the text cursor, and buttons and source relationships retain their pointer cursor.

## 0.1.10

- Expanding or collapsing Source on a relationship's focused target node now preserves the exact pinned edge and nearby inspection position.
- Collapsing Source on the relationship's origin still dismisses that focus, preventing a hidden Call Site or Function Reference from retaining an invisible source anchor.

## 0.1.9

- Source Expansion now requests semantic hover information from the active VS Code Rust language provider, normally rust-analyzer, for functions, types, variables, parameters, and other semantic tokens.
- Added a delayed, theme-aware hover card for Rust signatures and documentation with safe code and Markdown rendering.
- Existing graph interactions remain authoritative: relationship hover still reveals the exact edge, and left-click still focuses that relationship's target node while language information is visible.

## 0.1.8

- Exact source relationship handles are now clamped to the visible Source Expansion boundary when a long function name extends beyond the node.
- Horizontal source scrolling continuously refreshes the clamp, returning the handle to the function name as soon as its end becomes visible.

## 0.1.7

- A clicked source Call Site or Function Reference now keeps its target Function Node in the nearby inspection slot after pointer leave, for as long as that exact relationship remains focused.
- Hovering a second source relationship while one is focused reserves a second nearby slot without displacing the focused target.
- Replacing, dismissing, or navigating away from relationship focus restores the old target to its baseline or manually dragged position.

## 0.1.6

- A pinned source relationship now suppresses aggregate Function Node hover, so moving from the selected function name into the rest of its expanded node keeps only the exact pinned edge visible.
- Reduced collapsed-node horizontal and vertical whitespace by half while preserving node dimensions and readable labels.
- Expanded source nodes now shift compact right-hand columns outward temporarily, maintaining a 50 px inspection gap without overwriting baseline or manually dragged positions.
- Reduced expanded-source collision clearance and hovered-target proximity spacing to match the denser graph rhythm.

## 0.1.5

- Source relationship pinning is now exclusive: selecting another Call Site or Function Reference clears the previous graph-node selection and pinned edge before retaining the new edge.
- Qualified Rust paths such as `std::fs::read_to_string` remain continuously typeset while only the terminal function name is highlighted and interactive.
- Removed the per-relationship jump icon and its inline spacing from expanded source.

## 0.1.4

- Hovering a Call Site or Function Reference temporarily rearranges its target Function Node beside the expanded source node; leaving restores the baseline or manually dragged layout.
- Replaced directional expansion controls with lower-case, text-only **in**/**out** toggles. On state is highlighted; a second click removes that direction's branch from the canvas while retaining shared nodes and cached analysis.
- Function direction loading now resolves all direct relationships in one action up to the configurable graph node limit.
- Replaced and mechanically centered the Rust Call Graph toolbar mark.

## 0.1.3

- Aggregate hover/pinned edges from an expanded Function Node now share its right-side node endpoint, matching collapsed nodes.
- Only an exact source Call Site or Function Reference hover/pin switches that one edge to its source-range endpoint.
- Scrolling expanded source refreshes exact source-handle geometry.

## 0.1.2

- Expanded source now uses rust-analyzer semantic tokens with active VS Code theme colors.
- Expanded Function Nodes no longer reveal aggregate edges on node hover; exact source Call Sites and Function References reveal one edge.
- Increased graph typography and added a readable initial zoom floor while keeping **Fit** for full-graph overview.

## 0.1.1

- Expanded source nodes now use their measured size to push overlapping nodes aside.
- Collapsing source restores neighboring nodes to their baseline or manually dragged positions.
- Local Webview preview now supports expanding and collapsing the demo source node.

## 0.1.0

- Rust editor context-menu command backed by the active Call Hierarchy provider.
- Progressive caller, callee, Struct, and Enum graph with stable cyclic identities.
- Hidden-at-rest call and function-reference edges with node and source-range hover.
- Expandable source, exact relationship highlights, graph focus history, and Back navigation.
- Accessible node context menu with **Open Source in VS Code**.
- Debounced refresh, dependency boundaries, node limits, and stable manual positions.
