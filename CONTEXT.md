# Rust Program Graph

The product presents a source-backed, interactive view of relationships among Rust functions and data types without treating the visualization as a second source of program truth.

## Language

**Entry Function**:
The function or method under the cursor when the user requests a graph. It is the initial focus from which nearby relationships are revealed.
_Avoid_: root function, selected symbol, start node

**Function Graph**:
The progressively explored directed graph centered on an Entry Function and composed of Function Nodes, Type Nodes, and their relationships.
_Avoid_: workspace dump, call tree, dependency diagram

**Function Node**:
The single graph identity of one source-defined free function, implementation method, or trait method. Generic instantiations share the identity of their source definition.
_Avoid_: symbol box, monomorphized function, closure node

**Type Node**:
A graph identity for one source-defined Struct or Enum and the functions structurally associated with it.
_Avoid_: class node, object node, module node

**Struct**:
A Rust struct definition represented by a Type Node.
_Avoid_: class, record node

**Enum**:
A Rust enum definition represented by a Type Node.
_Avoid_: union, variant node

**Call Site**:
A source range inside a Function Node at which another function or method is invoked.
_Avoid_: reference, usage, edge anchor

**Function Reference**:
A source range inside a Function Node at which another function or method is used as a value without being invoked there.
_Avoid_: call, caller

**Call Edge**:
A directed relationship from a caller Function Node or one of its Call Sites to the invoked Function Node.
_Avoid_: dependency edge, usage edge

**Reference Edge**:
A directed relationship from a Function Node or one of its Function References to the referenced Function Node.
_Avoid_: call edge, import edge

**Source Expansion**:
The read-only presentation of a Function Node's complete source definition inside that node, including source-backed Call Sites and Function References.
_Avoid_: editor, source file, code preview

**Pinned Relationship**:
A relationship deliberately kept visible after its node or source range is selected. A pinned source relationship also keeps its target in a nearby inspection slot until the user dismisses or replaces it.
_Avoid_: permanent edge, selected node

**Graph Focus**:
The Function Node or Type Node currently brought into the user's visual attention without changing the active VS Code editor.
_Avoid_: editor selection, opened source, root node

**Return Point**:
The prior Graph Focus and viewport retained when the user follows a source relationship to another node.
_Avoid_: browser history, source location, undo state

**External Function**:
A function whose identity is known to the Function Graph but whose definition belongs to the Rust standard library or a Cargo dependency rather than the user's workspace.
_Avoid_: unresolved function, missing node, foreign function
