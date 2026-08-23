# Use a progressive graph with source identities

The Function Graph gives every source-defined function, method, Struct, and Enum one stable identity derived from its definition location, and reveals relationships progressively from an Entry Function. Recursion and cycles therefore reuse nodes instead of cloning a call tree, while one-hop loading and bounded expansion keep large workspaces usable. This favors an honest navigable program graph and stable manual layout over a complete eager workspace snapshot.

## Consequences

Callers are placed left of the Entry Function and callees right of it. Existing and manually moved nodes retain their positions when new nodes arrive. A Function direction toggle admits all direct relationships up to the graph's 250-node default cap; Struct and Enum association expansion remains batched at 50 nodes. External Functions remain dimmed leaves unless dependency expansion is enabled and source is available.
