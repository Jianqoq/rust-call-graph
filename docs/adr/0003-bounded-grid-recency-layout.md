# Use bounded grid cells with recent-target ordering

The Function Graph uses fixed rank columns and a finite set of vertical row cells per column. Hovering or selecting a source relationship does not invent a temporary coordinate: it promotes that relationship's target into the legal cell closest to the source, while older Recent Targets take progressively farther cells. A new source starts a new recent sequence.

## Consequences

Relationship inspection preserves the graph's horizontal topology and the occupied-cell set. Pointer leave changes edge visibility but not recent spatial ordering. Header dragging is vertical-only, bounded by the column's outer rows, and snaps back to legal cells on release. Source Expansion remains a measured presentation reflow: it may open vertical clearance or shift a complete right-hand column, but collapsing returns to the same bounded grid order.
