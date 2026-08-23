#[derive(Debug, Clone)]
pub struct Order {
    pub quantity: u64,
}

#[derive(Debug, Clone, Copy)]
pub enum OrderState {
    Draft,
    Submitted,
    Filled,
}

pub trait Gateway {
    fn submit(&self, order: &Order) -> OrderState;
}

impl Order {
    pub fn validate(&self) -> bool {
        self.quantity > 0
    }

    pub fn execute<G: Gateway>(&self, gateway: &G) -> OrderState {
        validate_order(self);
        let audit = audit_order;
        let state = gateway.submit(self);
        audit(self, state);
        state
    }
}

pub fn route_order<G: Gateway>(order: &Order, gateway: &G) -> OrderState {
    order.execute(gateway)
}

pub fn validate_order(order: &Order) -> bool {
    order.validate()
}

pub fn audit_order(_order: &Order, _state: OrderState) {}

pub fn recursive_depth(value: u32) -> u32 {
    if value == 0 { 0 } else { recursive_depth(value - 1) }
}

pub fn cycle_a(value: u32) -> u32 {
    if value == 0 { 0 } else { cycle_b(value - 1) }
}

pub fn cycle_b(value: u32) -> u32 {
    if value == 0 { 0 } else { cycle_a(value - 1) }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct DemoGateway;

    impl Gateway for DemoGateway {
        fn submit(&self, _order: &Order) -> OrderState {
            OrderState::Submitted
        }
    }

    #[test]
    fn routes_an_order() {
        let order = Order { quantity: 1 };
        assert!(matches!(route_order(&order, &DemoGateway), OrderState::Submitted));
    }
}
