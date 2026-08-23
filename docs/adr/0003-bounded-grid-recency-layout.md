# Use bounded grid cells with recent-target ordering

The Function Graph uses shared rank columns and a finite set of vertical row cells per column. Hovering or selecting a source relationship does not invent a temporary coordinate: it promotes that relationship's target into the legal cell closest to the source, while older Recent Targets take progressively farther cells. Each source keeps its own recent sequence. Multi-hop browsing composes those sequences from the oldest source to the newest, so a promoted target remains arranged when it becomes the next source. Columns have movable horizontal positions, but an individual cell never moves sideways without its complete column.

## Consequences

Relationship inspection preserves the graph's horizontal topology and the occupied-cell set. Pointer leave changes edge visibility but not recent spatial ordering. Vertical header dragging is bounded by the column's outer rows and swaps the dragged node with the nearest row occupant. Horizontal header dragging translates every node and cell in the originating column. Source Expansion remains a measured presentation reflow: it may open vertical clearance or shift a complete right-hand column, but collapsing returns to the same bounded grid order.
