# Rust Call Graph

Rust Call Graph is a source-backed, interactive call graph for Rust workspaces in VS Code. It uses the active Rust language provider—normally rust-analyzer—for semantic identity and renders the graph in a TypeScript Webview.

## First-release interactions

- Right-click inside a Rust function and choose **Show Rust Call Graph**.
- Drag a Function, Struct, or Enum Node from its header. Vertical movement swaps that node into a bounded row cell; horizontal movement translates its entire grid column, including every node and cell in that column. Node bodies retain the normal cursor, Source Expansion uses the text cursor, and interactive controls keep the pointer cursor.
- Collapsed Function Nodes show only their type/name header and **in**/**Source**/**out** controls; the redundant one-line signature preview is omitted.
- Hover any node to reveal its incident calls and function references from the node endpoint.
- When several aggregate relationships fan out from the same node into one target column, they share one trunk and retain independent arrowed branches. Calls and references use separate solid and dashed lanes; exact source relationships remain individually routed.
- Click the lower-case **in** or **out** button to show every direct caller or callee up to the graph limit; the highlighted button is on, and a second click removes that direction from the canvas without discarding its cached analysis.
- Expand a Function Node to inspect semantic-highlighted source; hovering an exact Call Site or Function Reference promotes its target into the closest available row cell in its existing column and switches only that edge to its source-range endpoint. Recently inspected targets stay ordered newest-nearest and older-farther after the pointer leaves.
- Source Expansion combines rust-analyzer semantic tokens with a lexical Rust fallback and a dedicated VS Code theme palette, so keywords, functions, types, variables, literals, strings, comments, and lifetimes remain visibly distinct even when symbol-icon colors match ordinary text.
- Pause over any semantic Rust token in Source Expansion to see signature and documentation content from the active VS Code hover provider, normally rust-analyzer. This uses the real workspace document and position rather than embedding a second editor or language server.
- Language hover does not replace graph interaction: a relationship function still highlights its exact edge on hover, and left-click still focuses/pins its target node.
- If a highlighted function name extends beyond the Source Expansion viewport, its exact edge endpoint stays on the visible right boundary; horizontal scrolling returns the endpoint to the function name when its end becomes visible.
- Scrolling a pinned Call Site or Function Reference keeps its endpoint aligned while the routed edge stays behind Function Nodes, preventing lines from overlaying Source Expansion or node controls.
- Single-click a highlighted source function to focus that one relationship. Its target stays in its recent grid position after the pointer leaves; clicking another highlighted function transfers the exact-edge focus and promotes the new target without accumulating pinned arrows.
- Expanding or collapsing Source on that focused target keeps its recent grid position; only hiding the origin Source that owns the relationship dismisses the focus.
- While an exact source relationship is pinned, moving over the rest of its Function Node does not reveal aggregate node connections; hovering another source function temporarily adds only that exact relationship.
- Double-click a highlighted source relationship to focus its target; use **Back** on the target node to return.
- Right-click any node and choose **Open Source in VS Code** to open its definition.
- Expand Struct and Enum methods progressively without duplicating cyclic nodes.
- The compact layout uses half the earlier horizontal and vertical whitespace. Nodes occupy shared, horizontally movable rank columns with bounded row cells; hover recency permutes cells vertically without creating free-form coordinates. Source Expansion can shift a complete right-hand column to prevent overlap and restores the grid when collapsed.

## Requirements

- VS Code 1.96 or newer
- A Rust language extension that provides call hierarchy and semantic tokens; rust-analyzer is recommended

## Development

```sh
pnpm install
pnpm check
pnpm package
```

The packaged `.vsix` is written to the repository root.

The domain language and accepted behavior are documented in `CONTEXT.md` and `docs/product-spec.md` in the source repository.
