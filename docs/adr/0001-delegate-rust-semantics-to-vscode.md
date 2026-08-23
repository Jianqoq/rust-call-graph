# Delegate Rust semantics to VS Code

The extension delegates function identity, call hierarchy, references, and source ranges to the active VS Code Rust language provider, normally rust-analyzer, instead of embedding a Rust parser or starting a second language server. The extension and its visualization remain TypeScript-owned. This accepts a runtime dependency on an available semantic Rust provider in exchange for Cargo-aware name resolution, trait and generic understanding, and consistency with the definitions that the editor itself navigates to.

## Consequences

The graph must label unavailable, ambiguous, dynamically dispatched, or non-source-mapped relationships honestly rather than guessing them. Struct and Enum discovery may compose other public VS Code language features, but it must not create a competing semantic authority.
