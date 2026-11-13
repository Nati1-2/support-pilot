from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timedelta
from backend.app.config import settings
from backend.app.models.ticket import EscalationSummary

class GuardrailService:
    def validate_shipping_address_update(self, order: Dict[str, Any], new_address: Dict[str, Any]) -> Tuple[bool, str]:
        order_number = order.get("order_number", "Unknown")
        status = order.get("status", "unknown").lower()

        # Strict Pre-dispatch Rule: Address can ONLY be updated if order is 'unfulfilled'
        if status != "unfulfilled":
            return (
                False,
                f"Address change rejected: Order {order_number} is currently '{status}'. Shipping address can only be modified prior to warehouse fulfillment and carrier dispatch."
            )

        # Validate required address fields
        street = new_address.get("street", "").strip()
        city = new_address.get("city", "").strip()
        state = new_address.get("state", "").strip()
        zip_code = new_address.get("zip_code", "").strip()

        if not street or not city or not state or not zip_code:
            return (
                False,
                "Address change rejected: Street, city, state, and zip code are strictly required."
            )

        return (True, f"Address change approved for pre-dispatch order {order_number}.")

    def validate_store_credit_issuance(
        self,
        order: Optional[Dict[str, Any]],
        customer: Dict[str, Any],
        requested_amount: float,
        workspace_cap: float = 50.0
    ) -> Tuple[bool, float, str]:
        # Rule: Amount must be positive
        if requested_amount <= 0:
            return (False, 0.0, "Credit issuance rejected: Requested amount must be greater than $0.00.")

        # Rule: Hard cap ($50.00 default or configured workspace cap)
        effective_cap = min(workspace_cap, settings.STORE_CREDIT_MAX_CAP)
        if requested_amount > effective_cap:
            return (
                False,
                effective_cap,
                f"Credit issuance blocked by guardrail: Requested amount (${requested_amount:.2f}) exceeds the absolute maximum store credit cap of ${effective_cap:.2f}."
            )

        # Rule: Cannot exceed order total if associated with an order
        if order:
            order_total = float(order.get("total_amount", 0.0))
            credits_issued = float(order.get("credits_issued", 0.0))
            if (credits_issued + requested_amount) > order_total:
                max_allowable = max(0.0, order_total - credits_issued)
                return (
                    False,
                    max_allowable,
                    f"Credit issuance rejected: Cumulative credit on order {order.get('order_number')} would exceed order total (${order_total:.2f})."
                )

        return (True, requested_amount, f"Store credit of ${requested_amount:.2f} complies with automated guardrail policy.")

    def validate_rma_label_generation(self, order: Dict[str, Any]) -> Tuple[bool, str]:
        order_number = order.get("order_number", "Unknown")
        status = order.get("status", "unknown").lower()

        # Rule: Order must be delivered
        if status != "delivered":
            return (
                False,
                f"RMA return label rejected: Order {order_number} status is '{status}'. Returns are only permitted for delivered merchandise."
            )

        # Rule: Must be within 30 days of delivery
        delivered_at_str = order.get("delivered_at")
        if delivered_at_str:
            try:
                if isinstance(delivered_at_str, str):
                    delivered_at = datetime.fromisoformat(delivered_at_str.replace("Z", "+00:00"))
                else:
                    delivered_at = delivered_at_str
                # compare days
                diff = (datetime.utcnow().replace(tzinfo=None) - delivered_at.replace(tzinfo=None)).days
                if diff > 30:
                    return (
                        False,
                        f"RMA return label rejected: Order {order_number} was delivered {diff} days ago, exceeding our 30-day return window."
                    )
            except Exception:
                pass

        return (True, f"RMA return authorization approved for delivered order {order_number}.")

    def generate_escalation_summary(
        self,
        customer: Dict[str, Any],
        intent: str,
        reason: str,
        recommended_action: str
    ) -> EscalationSummary:
        name = customer.get("name", "Customer")
        total_spent = customer.get("total_spent", 0.0)
        is_vip = total_spent >= settings.VIP_SPENT_THRESHOLD

        bullets = [
            f"Customer Profile: {name} ({'VIP Tier - $' + f'{total_spent:.2f}' + ' LTV' if is_vip else 'Standard Customer'})",
            f"Detected Issue: Customer inquiry regarding '{intent}' requires review. Trigger: {reason}",
            f"Recommended Next Step: {recommended_action}"
        ]

        return EscalationSummary(
            bullets=bullets,
            trigger_reason=reason,
            recommended_action=recommended_action
        )

guardrail_service = GuardrailService()
