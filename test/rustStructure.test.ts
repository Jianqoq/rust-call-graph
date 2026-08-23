import { describe, expect, it } from 'vitest';
import { scanRustStructure } from '../src/extension/rustStructure.js';

describe('scanRustStructure', () => {
  it('discovers structs, enums, variants, and associated functions', () => {
    const source = `
pub struct Order<T> {
    value: T,
}

pub enum OrderState {
    Draft,
    Submitted { venue: String },
    Filled(u64),
}

impl<T> Order<T> {
    pub fn new(value: T) -> Self { Self { value } }

    pub fn execute(&self) {
        fn nested_helper() {}
        nested_helper();
    }
}

impl<T> Display for Order<T> {
    fn fmt(&self) {}
}
`;

    const types = scanRustStructure(source);
    const order = types.find(type => type.name === 'Order');
    const state = types.find(type => type.name === 'OrderState');

    expect(order?.kind).toBe('struct');
    expect(order?.methods.map(method => method.name)).toEqual(['new', 'execute', 'fmt']);
    expect(state?.kind).toBe('enum');
    expect(state?.variants).toEqual(['Draft', 'Submitted', 'Filled']);
  });

  it('ignores declarations inside comments and string literals', () => {
    const source = `
// struct Phantom { }
const TEXT: &str = r#"enum Mirage { A }"#;
/* impl Real { fn fake() {} } */
struct Real;
impl Real { fn actual() {} }
`;
    const types = scanRustStructure(source);
    expect(types).toHaveLength(1);
    expect(types[0]?.name).toBe('Real');
    expect(types[0]?.methods.map(method => method.name)).toEqual(['actual']);
  });
});
