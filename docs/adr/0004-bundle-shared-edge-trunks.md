# ADR 0004: Bundle shared aggregate edge trunks

## Status

Accepted

## Context

React Flow's SmoothStep renderer creates a complete SVG path for every relationship. Aggregate fan-out edges from one Function Node to nodes in the same rank column therefore repeat the same source stem and vertical routing lane. The paths remain semantically correct, but painting the identical segments several times produces a bright, heavy band that looks like duplicate graph data.

Exact Call Site and Function Reference edges have source-range-specific coordinates and must remain independently routed. Call and Reference styles also encode different meanings with solid and dashed strokes.

## Decision

For visible aggregate fan-out edges, group relationships by source node, aggregate source handle, direction, relationship kind, and target column. A group with at least two relationships draws:

- one shared source stem and vertical trunk;
- one horizontal target branch and arrowhead per relationship.

Call and Reference groups receive adjacent lanes and never share a trunk. Membership edges retain SmoothStep routing. Exact source-range edges are excluded from bundling. Bundles are recalculated from live node geometry so column translation, vertical cell swaps, and Source Expansion reflow update the paths.

## Consequences

Repeated segments are painted once without collapsing graph identities, target arrows, accessibility labels, or relationship interactions. Bundle branches remain selectable through each edge's interaction path. The custom renderer owns orthogonal branch geometry, while unbundled edges continue to use React Flow SmoothStep routing.
