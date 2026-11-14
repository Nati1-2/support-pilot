import os
import re
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import httpx

from backend.app.config import settings
from backend.app.database import get_collection
from backend.app.services.pii_service import pii_service
from backend.app.services.rag_service import rag_service
from backend.app.services.guardrail_service import guardrail_service
from backend.app.services.idempotency_service import idempotency_service
from backend.app.models.ticket import PolicyCitation, ProposedAction, EscalationSummary, GeminiAgentResult
from backend.app.models.audit import AuditTrace, ExecutionStep

class AgentService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL

    async def process_inquiry(
        self,
        workspace_id: str,
        customer_id: str,
        message_content: str,
        order_id: Optional[str] = None,
        existing_ticket_id: Optional[str] = None,
        channel: str = "email",
        conversation_history: Optional[str] = None,
    ) -> Dict[str, Any]:
        execution_steps: List[ExecutionStep] = []
        guardrail_notes: List[str] = []

        # Step 1: PII Sanitization
        sanitized_content, redaction_count, detected_pii_types = pii_service.redact(message_content)
        execution_steps.append(ExecutionStep(
            step_name="pii_sanitization",
            status="warning" if redaction_count > 0 else "success",
            details={
                "redactions_count": redaction_count,
                "detected_types": detected_pii_types,
                "preview_sanitized": sanitized_content[:120] + "..." if len(sanitized_content) > 120 else sanitized_content
            }
        ))

        # Step 2: Customer Profile Retrieval
        customers_col = get_collection("customers")
        customer = await customers_col.find_one({"_id": customer_id, "workspace_id": workspace_id})
        if not customer:
            customer = {
                "_id": customer_id,
                "name": "Guest Customer",
                "email": "customer@example.com",
                "total_spent": 0.0,
                "orders_count": 0,
                "is_vip": False
            }

        is_vip = customer.get("total_spent", 0.0) >= settings.VIP_SPENT_THRESHOLD

        # Step 3: Order Investigation (by order_id or parsed from message)
        orders_col = get_collection("orders")
        order = None
        if order_id:
            order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})

        if not order:
            # Try to extract order number from text, e.g. ORD-1092 or #1092
            order_match = re.search(r'\b(?:ORD-?|#)?(\d{4,6})\b', sanitized_content, re.IGNORECASE)
            if order_match:
                digits = order_match.group(1)
                order = await orders_col.find_one({
                    "workspace_id": workspace_id,
                    "$or": [
                        {"order_number": f"ORD-{digits}"},
                        {"order_number": digits}
                    ]
                })

        # If still no specific order, fetch latest customer order
        if not order:
            recent_orders = await orders_col.find({"customer_id": customer_id, "workspace_id": workspace_id}).sort("created_at", -1).to_list(length=1)
            if recent_orders:
                order = recent_orders[0]

        execution_steps.append(ExecutionStep(
            step_name="order_investigation",
            status="success" if order else "skipped",
            details={
                "order_found": bool(order),
                "order_number": order.get("order_number") if order else "None",
                "status": order.get("status") if order else "N/A",
                "total_amount": order.get("total_amount") if order else 0.0
            }
        ))

        # Step 4: Intent, Sentiment & Urgency Classification
        classification = self._classify_intent_and_sentiment(sanitized_content, is_vip, order)
        intent = classification["intent"]
        sentiment = classification["sentiment"]
        urgency = classification["urgency"]
        is_vip_churn_risk = is_vip and sentiment in ["negative", "frustrated"]

        execution_steps.append(ExecutionStep(
            step_name="intent_classification",
            status="warning" if is_vip_churn_risk else "success",
            details={
                "intent": intent,
                "sentiment": sentiment,
                "urgency": urgency,
                "vip_churn_risk": is_vip_churn_risk
            }
        ))

        # Step 5: Policy RAG Retrieval
        rag_query = f"{intent} {sanitized_content}"
        citations = await rag_service.search_policies(workspace_id, rag_query, limit=2)
        policy_ids = [c.section_id for c in citations]
        execution_steps.append(ExecutionStep(
            step_name="policy_retrieval",
            status="success" if citations else "warning",
            details={
                "citations_count": len(citations),
                "cited_sections": [c.title for c in citations],
                "top_score": citations[0].relevance_score if citations else 0.0
            }
        ))

        # Step 6: Generate Response & Determine Proposed Action
        # Check if live Gemini API key is configured
        ai_result = None
        engine_mode = "simulated"
        greeting = re.fullmatch(r"\s*(hi|hello|hey|good morning|good afternoon|good evening)[!.?\s]*", sanitized_content, re.IGNORECASE)
        if greeting:
            ai_result = {"reply": "Hello! How can I help you with your order or support request?", "confidence": 1.0, "proposed_action": None}
        elif self.api_key:
            try:
                inquiry_context = sanitized_content
                if conversation_history:
                    safe_history, _, _ = pii_service.redact(conversation_history)
                    inquiry_context = f"Previous conversation (context only):\n{safe_history}\n\nLatest customer message to answer:\n{sanitized_content}"
                ai_result = await self._call_live_gemini(
                    workspace_id, inquiry_context, customer, order, citations, intent
                )
                engine_mode = "gemini_live"
            except Exception as e:
                print(f"[AgentService] Gemini Live call failed ({e}). Using deterministic engine.")
                ai_result = None

        if not ai_result:
            ai_result = self._deterministic_agent_reasoning(
                sanitized_content, customer, order, citations, intent, sentiment, is_vip_churn_risk
            )
            engine_mode = "simulated"

        confidence_score = ai_result["confidence"]
        draft_reply = ai_result["reply"]
        proposed_action_spec = ai_result.get("proposed_action")

        # Step 7: Deterministic Backend Guardrails Verification
        guardrail_passed = True
        gated_action = None
        action_status = "evaluated"

        # Fetch workspace settings
        workspaces_col = get_collection("workspaces")
        ws = await workspaces_col.find_one({"_id": workspace_id})
        ws_settings = ws.get("settings", {}) if ws else {}
        conf_threshold = ws_settings.get("confidence_threshold", settings.CONFIDENCE_THRESHOLD)
        credit_cap = ws_settings.get("store_credit_max_cap", settings.STORE_CREDIT_MAX_CAP)
        auto_pilot_enabled = ws_settings.get("auto_pilot_enabled", True)

        if proposed_action_spec and order:
            action_type = proposed_action_spec.get("action_type")
            params = proposed_action_spec.get("parameters", {})

            if action_type == "update_shipping_address":
                passed, reason = guardrail_service.validate_shipping_address_update(order, params.get("shipping_address", {}))
                guardrail_notes.append(reason)
                if not passed:
                    guardrail_passed = False
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="rejected",
                        reason=reason
                    )
                else:
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="pending_approval",
                        reason=reason
                    )

            elif action_type == "issue_store_credit":
                amount = float(params.get("amount", 15.0))
                passed, allowable, reason = guardrail_service.validate_store_credit_issuance(order, customer, amount, credit_cap)
                guardrail_notes.append(reason)
                if not passed:
                    guardrail_passed = False
                    # Cap if over limit or queue for approval
                    params["amount"] = allowable
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="pending_approval",
                        reason=f"Exceeded auto-threshold: {reason}"
                    )
                else:
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="pending_approval" if amount > 25.0 else "approved",
                        reason=reason
                    )

            elif action_type == "generate_rma_label":
                passed, reason = guardrail_service.validate_rma_label_generation(order)
                guardrail_notes.append(reason)
                if not passed:
                    guardrail_passed = False
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="rejected",
                        reason=reason
                    )
                else:
                    gated_action = ProposedAction(
                        action_type=action_type,
                        parameters=params,
                        status="approved",
                        reason=reason
                    )

        # Step 8: Routing Decision (Auto-Pilot vs Needs Approval)
        requires_approval = False
        escalation_summary = None
        ticket_status = "open"

        if is_vip_churn_risk:
            requires_approval = True
            ticket_status = "needs_approval"
            escalation_summary = guardrail_service.generate_escalation_summary(
                customer, intent, "VIP Customer with negative sentiment (VIP_CHURN_RISK)",
                "Offer personalized apology, review delay/defect, and consider up to $25 goodwill credit."
            )
            guardrail_notes.append("Routed to VIP / Critical Review Queue due to high LTV and negative sentiment.")

        elif not guardrail_passed or (gated_action and gated_action.status == "pending_approval"):
            requires_approval = True
            ticket_status = "needs_approval"
            escalation_summary = guardrail_service.generate_escalation_summary(
                customer, intent, f"Gated action requires human sign-off ({guardrail_notes[-1] if guardrail_notes else 'Action approval'})",
                "Verify order status and approve or modify proposed resolution."
            )

        elif confidence_score < conf_threshold:
            requires_approval = True
            ticket_status = "needs_approval"
            escalation_summary = guardrail_service.generate_escalation_summary(
                customer, intent, f"AI confidence score ({confidence_score:.2f}) below threshold ({conf_threshold:.2f})",
                "Review draft reply and confirm response accuracy."
            )
        else:
            # Autonomous Auto-Pilot Deflection
            if auto_pilot_enabled:
                ticket_status = "resolved"
                action_status = "auto_executed"
                if gated_action and gated_action.status == "approved":
                    # Execute approved action
                    await self._execute_approved_action(
                        workspace_id,
                        order,
                        gated_action,
                        f"{existing_ticket_id or uuid.uuid4().hex}:{gated_action.action_type}",
                    )
                    gated_action.status = "executed"
                    gated_action.executed_at = datetime.utcnow()
            else:
                ticket_status = "open"

        execution_steps.append(ExecutionStep(
            step_name="guardrail_and_routing",
            status="warning" if requires_approval else "success",
            details={
                "confidence_score": confidence_score,
                "confidence_threshold": conf_threshold,
                "auto_pilot_deflected": not requires_approval and auto_pilot_enabled,
                "requires_human_approval": requires_approval,
                "ticket_status": ticket_status,
                "engine_mode": engine_mode
            }
        ))

        # Build Audit Trace
        trace_id = str(uuid.uuid4())
        audit_trace = AuditTrace(
            _id=trace_id,
            workspace_id=workspace_id,
            ticket_id=existing_ticket_id or "new",
            trigger="customer_message",
            intent=intent,
            sentiment=sentiment,
            urgency=urgency,
            pii_redacted=redaction_count > 0,
            redacted_items_count=redaction_count,
            order_looked_up=order.get("order_number") if order else None,
            policies_cited=policy_ids,
            confidence_score=confidence_score,
            guardrails_passed=guardrail_passed,
            guardrail_details=guardrail_notes,
            selected_action=gated_action.action_type if gated_action else "generate_reply",
            action_parameters=gated_action.parameters if gated_action else {},
            action_status="queued_for_approval" if requires_approval else "auto_executed",
            execution_steps=execution_steps,
            escalation_reason=escalation_summary.trigger_reason if escalation_summary else None,
            created_at=datetime.utcnow()
        )

        audit_col = get_collection("audit_traces")
        await audit_col.insert_one(audit_trace.model_dump(by_alias=True))

        return {
            "intent": intent,
            "sentiment": sentiment,
            "urgency": urgency,
            "is_vip": is_vip,
            "vip_churn_risk": is_vip_churn_risk,
            "confidence_score": confidence_score,
            "draft_reply": draft_reply,
            "citations": citations,
            "requires_approval": requires_approval,
            "ticket_status": ticket_status,
            "escalation_summary": escalation_summary,
            "proposed_action": gated_action,
            "order": order,
            "customer": customer,
            "audit_trace_id": trace_id,
            "engine_mode": engine_mode
        }

    def _classify_intent_and_sentiment(self, text: str, is_vip: bool, order: Optional[Dict[str, Any]]) -> Dict[str, str]:
        t = text.lower()

        # Sentiment detection
        if any(w in t for w in ["terrible", "horrible", "furious", "unacceptable", "scam", "ridiculous", "worst", "angry", "lawyer", "demand"]):
            sentiment = "frustrated"
        elif any(w in t for w in ["disappointed", "annoyed", "late", "where is", "not happy", "damaged", "wrong", "broken"]):
            sentiment = "negative"
        elif any(w in t for w in ["thank", "great", "awesome", "perfect", "appreciate", "helpful", "good"]):
            sentiment = "positive"
        else:
            sentiment = "neutral"

        # Intent detection
        if any(w in t for w in ["address", "change address", "shipping address", "apartment", "wrong address"]):
            intent = "address_change"
        elif any(w in t for w in ["return", "rma", "send back", "exchange", "refund"]):
            intent = "return_rma"
        elif any(w in t for w in ["delay", "delayed", "tracking", "status", "where is my order", "has not arrived", "late"]):
            intent = "shipping_delay"
        elif any(w in t for w in ["credit", "store credit", "discount", "compensation", "coupon"]):
            intent = "store_credit"
        elif any(w in t for w in ["cancel", "cancellation", "stop order"]):
            intent = "order_cancellation"
        elif any(w in t for w in ["size", "fabric", "material", "fit", "restock"]):
            intent = "product_inquiry"
        else:
            intent = "general_support"

        # Urgency
        if sentiment in ["frustrated"] or (is_vip and sentiment == "negative"):
            urgency = "urgent"
        elif sentiment == "negative" or intent in ["address_change", "order_cancellation"]:
            urgency = "high"
        elif intent in ["shipping_delay", "return_rma"]:
            urgency = "medium"
        else:
            urgency = "low"

        return {"intent": intent, "sentiment": sentiment, "urgency": urgency}

    def _deterministic_agent_reasoning(
        self,
        sanitized_content: str,
        customer: Dict[str, Any],
        order: Optional[Dict[str, Any]],
        citations: List[PolicyCitation],
        intent: str,
        sentiment: str,
        is_vip_churn_risk: bool
    ) -> Dict[str, Any]:
        customer_name = customer.get("name", "there")
        order_num = order.get("order_number") if order else "your recent order"
        order_status = order.get("status") if order else "processing"

        proposed_action = None
        confidence = 0.92

        if intent == "shipping_delay":
            tracking = order.get("tracking_number", "TRK-9817234") if order else "TRK-9817234"
            est = order.get("estimated_delivery", "within 2 business days") if order else "within 2 business days"
            reply = (
                f"Hello {customer_name},\n\n"
                f"Thank you for reaching out. We looked into your order {order_num}. "
                f"The carrier ({order.get('carrier', 'FedEx') if order else 'FedEx'}) is currently processing the package under tracking number {tracking}. "
                f"The updated estimated delivery is {est}.\n\n"
                f"In accordance with our Shipping Delays Policy, we have applied a $15.00 courtesy store credit to your account for the inconvenience.\n\n"
                f"Please let us know if we can assist with anything else!"
            )
            proposed_action = {
                "action_type": "issue_store_credit",
                "parameters": {"amount": 15.0, "reason": f"Shipping delay courtesy for {order_num}"}
            }
            confidence = 0.94

        elif intent == "address_change":
            # Extract possible address
            new_addr = {
                "street": "742 Evergreen Terrace",
                "city": "Springfield",
                "state": "OR",
                "zip_code": "97477",
                "country": "United States"
            }
            if order_status == "unfulfilled":
                reply = (
                    f"Hello {customer_name},\n\n"
                    f"We received your request to update the delivery address for order {order_num}. "
                    f"Because your order is currently pre-dispatch (unfulfilled in warehouse), our team can update the destination.\n\n"
                    f"Please confirm if the destination should be updated as requested."
                )
                proposed_action = {
                    "action_type": "update_shipping_address",
                    "parameters": {"order_number": order_num, "shipping_address": new_addr}
                }
                confidence = 0.88
            else:
                reply = (
                    f"Hello {customer_name},\n\n"
                    f"Thank you for contacting us. We investigated order {order_num}. "
                    f"Per our Address Modification Policy, addresses can only be modified prior to warehouse dispatch. "
                    f"Because order {order_num} is already '{order_status}', carrier routing is locked.\n\n"
                    f"We recommend contacting the carrier directly with your tracking number or requesting a package hold at your nearest pickup facility."
                )
                confidence = 0.91

        elif intent == "return_rma":
            if order_status == "delivered":
                reply = (
                    f"Hello {customer_name},\n\n"
                    f"We are happy to help with your return for order {order_num}. "
                    f"Under our 30-Day Return Policy, your order is fully eligible for a prepaid return label.\n\n"
                    f"We have generated your return authorization and prepaid shipping label. Please affix it to the original package and hand it to any USPS carrier."
                )
                proposed_action = {
                    "action_type": "generate_rma_label",
                    "parameters": {"order_number": order_num, "reason": "Customer return request"}
                }
                confidence = 0.95
            else:
                reply = (
                    f"Hello {customer_name},\n\n"
                    f"Thank you for inquiring about returns. Order {order_num} is currently '{order_status}' and has not yet been marked as delivered. "
                    f"Return authorizations can be issued once the package is delivered. Once received, simply reply here and we will immediately provide a prepaid RMA label."
                )
                confidence = 0.86

        elif intent == "store_credit":
            reply = (
                f"Hello {customer_name},\n\n"
                f"Thank you for your feedback regarding order {order_num}. As valued members of AeroWear Goods, we take satisfaction seriously. "
                f"In accordance with our Store Credit Goodwill Policy, we have authorized a $20.00 store credit toward your next purchase."
            )
            proposed_action = {
                "action_type": "issue_store_credit",
                "parameters": {"amount": 20.0, "reason": "Goodwill resolution"}
            }
            confidence = 0.89

        else:
            reply = (
                f"Hello {customer_name},\n\n"
                f"Thank you for contacting AeroWear customer support. We are reviewing your inquiry regarding {intent.replace('_', ' ')}. "
                f"A customer care specialist will follow up with detailed guidance tailored to your account."
            )
            confidence = 0.72

        if is_vip_churn_risk:
            confidence = min(confidence, 0.78)

        return {
            "reply": reply,
            "confidence": confidence,
            "proposed_action": proposed_action
        }

    async def _call_live_gemini(
        self,
        workspace_id: str,
        sanitized_content: str,
        customer: Dict[str, Any],
        order: Optional[Dict[str, Any]],
        citations: List[PolicyCitation],
        intent: str
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        feedback_rows = await get_collection("edit_feedback").find(
            {"workspace_id": workspace_id, "action_decision": "edited_and_approved"}
        ).sort("created_at", -1).limit(3).to_list()
        feedback_examples = "\n\n".join(
            f"Original draft: {row.get('original_draft', '')[:500]}\nApproved edit: {row.get('edited_draft', '')[:500]}"
            for row in feedback_rows
        ) or "No prior approved edits are available."

        system_instruction = (
            "You are the SupportPilot AI customer support agent for an e-commerce brand. "
            "Respond professionally, concisely, and cite official store policies where relevant. "
            "Output only JSON with exactly: 'reply' (string), 'confidence' (number 0.0-1.0), "
            "and 'proposed_action' (null or an object with action_type and parameters)."
        )

        citation_text = "\n".join([f"- [{c.title}]: {c.snippet}" for c in citations])
        prompt = (
            f"Customer: {customer.get('name')} (Total Spent: ${customer.get('total_spent', 0)})\n"
            f"Order Context: {order.get('order_number') if order else 'None'} (Status: {order.get('status') if order else 'None'})\n"
            f"Relevant Policies:\n{citation_text}\n\n"
            f"Recent human-approved edits to learn tone from:\n{feedback_examples}\n\n"
            f"Customer Inquiry: {sanitized_content}\n\n"
            f"Return valid JSON only matching the schema."
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2
            }
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                validated = GeminiAgentResult.model_validate_json(text)
                return validated.model_dump()
            else:
                raise Exception(f"Gemini API returned status {resp.status_code}: {resp.text}")

    async def _execute_approved_action(
        self,
        workspace_id: str,
        order: Dict[str, Any],
        action: ProposedAction,
        idempotency_key: str,
    ):
        orders_col = get_collection("orders")
        order_id = str(order["_id"])
        operation = f"agent:{order_id}:{action.action_type}"
        replay = await idempotency_service.get(workspace_id, operation, idempotency_key)
        if replay:
            return replay

        if action.action_type == "update_shipping_address":
            new_addr = action.parameters.get("shipping_address")
            if new_addr:
                await orders_col.update_one(
                    {"_id": order_id, "workspace_id": workspace_id},
                    {"$set": {"shipping_address": new_addr}}
                )

        elif action.action_type == "issue_store_credit":
            amount = float(action.parameters.get("amount", 0.0))
            if amount > 0:
                await orders_col.update_one(
                    {"_id": order_id, "workspace_id": workspace_id},
                    {"$inc": {"credits_issued": amount}}
                )

        elif action.action_type == "generate_rma_label":
            rma_id = f"RMA-{uuid.uuid4().hex[:8].upper()}"
            rma_obj = {
                "label_id": rma_id,
                "tracking_number": f"9400111899223{uuid.uuid4().hex[:6]}",
                "carrier": "USPS Return Service",
                "status": "active",
                "created_at": datetime.utcnow().isoformat()
            }
            await orders_col.update_one(
                {"_id": order_id, "workspace_id": workspace_id},
                {"$push": {"rma_labels": rma_obj}}
            )

        response = {"status": "success", "action_type": action.action_type, "order_id": order_id}
        await idempotency_service.store(
            workspace_id,
            operation,
            idempotency_key,
            {"action": action.model_dump()},
            response,
        )
        return response

agent_service = AgentService()
