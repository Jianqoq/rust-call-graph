# Quiet Topology

The graph should feel like an instrument panel for reading code, not a diagram exported from a build tool. Space is calm and mostly empty until the user asks a relationship to become visible. Nodes use restrained surfaces and sharp typographic hierarchy; the Rust source remains the densest and most important texture.

Color carries relationship kind but never carries it alone. Calls use a solid treatment, references a dashed treatment, and structural/type information a quieter neutral treatment. All colors derive from VS Code semantic tokens so the composition belongs naturally to the user's current theme, including high contrast.

The Entry Function is visually anchored without becoming oversized. Incoming nodes occupy a compact measured field to the left and outgoing nodes to the right; horizontal and vertical whitespace is half the original rhythm while node size and typography remain unchanged. Progressive additions grow locally around their origin, preserving the reader's spatial memory instead of continuously performing a dramatic global relayout. When source expands a node, measured collision space opens locally and compact right-hand columns shift just beyond its width; collapse returns neighbors to their baseline positions. Hovering a source relationship creates a temporary inspection composition: its target moves beside the expanded source and nearby nodes yield. Clicking that relationship holds the composition after pointer leave; a second hover occupies the next nearby slot, and dismissing or transferring focus restores the former target.

The inspection composition belongs to the focused relationship, not to the target's collapsed dimensions. Expanding the target may make a small vertical clearance adjustment, but it remains in the same nearby inspection column until the relationship is dismissed or its origin Source is hidden.

Edges are latent structure. The idle canvas communicates topology through node placement; hover and selection reveal only the relevant paths. Aggregate relationships always share the node's right-side origin, including during Source Expansion. A source highlight becomes a precise edge origin only while that exact Call Site or Function Reference is hovered or pinned, making the transition from text to graph feel mechanical and trustworthy. An exact pin owns visibility until dismissed or replaced, preventing the surrounding node hover from flooding the canvas with unrelated edges.

All edges live below Function and Type Nodes. An exact source endpoint can follow a scrolled Call Site or Function Reference, but the line is masked by the expanded node until it exits the node boundary; source text, the sticky legend, and node actions therefore remain visually uninterrupted.

Source endpoints remain spatially honest when identifiers are wider than the node. The endpoint follows the identifier's right edge while visible, clamps to the Source Expansion's right boundary while the text overflows, and follows the text again as horizontal scrolling reveals its end.

Language information appears as a restrained VS Code-native hover surface rather than turning Source Expansion into a second editor. The active token receives a quiet rectangular emphasis; after a short dwell, a compact card presents the provider's Rust signature and documentation. The card inherits editor hover colors, remains legible above the graph, and never steals the immediate call-edge response or the left-click relationship action.

Syntax color uses a layered model: rust-analyzer semantic tokens own known ranges, while a non-semantic Rust lexer supplies only missing lexical categories such as keywords, literals, comments, and lifetimes. Both layers resolve through VS Code theme variables.

Motion is brief, functional, and optional. Focus transitions clarify where navigation landed, while reduced-motion mode replaces them with immediate positioning. Focus rings, labels, line patterns, and shape ensure every interaction remains understandable without animation or color.

Dragging is a header-level affordance rather than a property of every node surface. The header uses `grab`/`grabbing`; node content stays visually neutral, source reads as selectable text, and actionable controls keep the pointer cursor.

Direction controls are deliberately quiet: **in** and **out** are lower-case text without directional icons. Their filled active state communicates that a branch is present on the canvas; the same state is exposed with `aria-pressed`.

Readability outranks showing every node at once. The initial viewport keeps source and node labels above a practical visual size, while **Fit** deliberately offers a denser overview. Source typography follows the editor font settings and semantic categories inherit colors from the active VS Code theme.
