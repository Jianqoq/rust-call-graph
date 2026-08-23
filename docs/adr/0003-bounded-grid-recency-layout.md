# Use bounded grid cells with recent-target ordering

The Function Graph uses shared rank columns and a finite set of vertical row cells per column. Hovering or selecting a source relationship does not invent a temporary coordinate: it promotes that relationship's target into the legal cell closest to the source, while older Recent Targets take progressively farther cells. A new source starts a new recent sequence. Columns have movable horizontal positions, but an individual cell never moves sideways without its complete column.

A Function Node reached through multiple outgoing depths belongs to its deepest acyclic rank. Strongly connected recursive relationships are treated as one cycle boundary for rank advancement, so cycles cannot increase their rank indefinitely. When saved coordinates from an earlier, shallower graph would place two ranks at the same x coordinate, the deeper rank claims the next free whole-column position.

## Consequences

Relationship inspection preserves the graph's horizontal topology and the occupied-cell set. Pointer leave changes edge visibility but not recent spatial ordering. Vertical header dragging is bounded by the column's outer rows and swaps the dragged node with the nearest row occupant. Horizontal header dragging translates every node and cell in the originating column. Source Expansion remains a measured presentation reflow: it may open vertical clearance or shift a complete right-hand column, but collapsing returns to the same bounded grid order.
