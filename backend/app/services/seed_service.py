import uuid
from datetime import datetime, timedelta
from backend.app.config import settings
from backend.app.database import get_collection
from backend.app.services.auth_service import hash_password


async def migrate_legacy_ai_citations(workspace_id: str):
    """Backfill policy sources on demo AI replies created before citation enforcement."""
    intent_policy = {
        "return_request": "pol_01",
        "refund_request": "pol_01",
        "address_change": "pol_02",
        "shipping_delay": "pol_03",
        "order_status": "pol_03",
        "store_credit": "pol_04",
        "payment_problem": "pol_06",
    }
    tickets_col = get_collection("tickets")
    messages_col = get_collection("messages")
    policies_col = get_collection("policy_sections")
    messages = await messages_col.find({"workspace_id": workspace_id, "sender_type": "ai"}).to_list()
    for message in messages:
        if message.get("citations"):
            continue
        ticket = await tickets_col.find_one({
            "_id": message.get("ticket_id"),
            "workspace_id": workspace_id,
        })
        if not ticket:
            continue
        policy_id = intent_policy.get(ticket.get("intent"), "pol_05")
        policy = await policies_col.find_one({"_id": policy_id, "workspace_id": workspace_id})
        if not policy:
            continue
        content = policy.get("content") or policy.get("summary") or "Official store policy source."
        citation = {
            "section_id": policy_id,
            "title": policy.get("title", "Store Policy"),
            "relevance_score": 0.90,
            "snippet": content[:260],
        }
        await messages_col.update_one(
            {"_id": message["_id"], "workspace_id": workspace_id},
            {"$set": {"citations": [citation]}},
        )
        if not ticket.get("citations"):
            await tickets_col.update_one(
                {"_id": ticket["_id"], "workspace_id": workspace_id},
                {"$set": {"citations": [citation]}},
            )

async def seed_initial_data():
    ws_col = get_collection("workspaces")
    existing_ws = await ws_col.find_one({"_id": settings.DEFAULT_WORKSPACE_ID})
    if existing_ws:
        # Migrate the legacy v2.0 demo default to the SRS-required 90% gate.
        current_settings = existing_ws.get("settings", {})
        if current_settings.get("confidence_threshold", 0) < settings.CONFIDENCE_THRESHOLD:
            current_settings["confidence_threshold"] = settings.CONFIDENCE_THRESHOLD
            await ws_col.update_one(
                {"_id": settings.DEFAULT_WORKSPACE_ID},
                {"$set": {"settings": current_settings}},
            )
        users_col = get_collection("users")
        if not await users_col.find_one({"email": "customer@aerowear.com"}):
            await users_col.insert_one({
                "_id": "usr_customer_01",
                "email": "customer@aerowear.com",
                "hashed_password": hash_password("customer123"),
                "full_name": "Sophia Rodriguez",
                "role": "customer",
                "customer_id": "cust_sophia",
                "workspace_id": settings.DEFAULT_WORKSPACE_ID,
                "created_at": datetime.utcnow(),
            })
        policies_col = get_collection("policy_sections")
        if not await policies_col.find_one({"_id": "pol_06", "workspace_id": settings.DEFAULT_WORKSPACE_ID}):
            await policies_col.insert_one({
                "_id": "pol_06",
                "workspace_id": settings.DEFAULT_WORKSPACE_ID,
                "title": "Payment Failure Recovery Policy",
                "category": "payments",
                "summary": "Failed payments require secure in-app recovery without collecting card data in support messages.",
                "content": "When a payment fails, create a proactive in-app notification and support ticket. Direct the customer to the secure checkout to update payment details. Never request or store raw card numbers in a ticket or support message.",
                "tags": ["payment", "payment_failed", "card", "recovery", "security"],
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })
        await migrate_legacy_ai_citations(settings.DEFAULT_WORKSPACE_ID)
        return  # already seeded

    print("[Seed] Seeding initial demo data for SupportPilot AI v2.0...")
    ws_id = settings.DEFAULT_WORKSPACE_ID

    # 1. Workspace
    await ws_col.insert_one({
        "_id": ws_id,
        "name": "AeroWear Goods (Production)",
        "slug": "aerowear-prod",
        "settings": {
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "store_credit_max_cap": 50.0,
            "auto_pilot_enabled": True,
            "delay_compensation_credit": 15.0,
            "gemini_model": "gemini-2.5-flash",
            "simulated_carrier": "FedEx Express"
        },
        "created_at": datetime.utcnow()
    })

    # 2. Users
    users_col = get_collection("users")
    await users_col.insert_many([
        {
            "_id": "usr_admin_01",
            "email": "admin@aerowear.com",
            "hashed_password": hash_password("admin123"),
            "full_name": "Alexander Hayes",
            "role": "admin",
            "workspace_id": ws_id,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "usr_agent_01",
            "email": "sarah.support@aerowear.com",
            "hashed_password": hash_password("agent123"),
            "full_name": "Sarah Jenkins",
            "role": "agent",
            "workspace_id": ws_id,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "usr_viewer_01",
            "email": "viewer@aerowear.com",
            "hashed_password": hash_password("viewer123"),
            "full_name": "Elena Rostova",
            "role": "viewer",
            "workspace_id": ws_id,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "usr_customer_01",
            "email": "customer@aerowear.com",
            "hashed_password": hash_password("customer123"),
            "full_name": "Sophia Rodriguez",
            "role": "customer",
            "customer_id": "cust_sophia",
            "workspace_id": ws_id,
            "created_at": datetime.utcnow()
        }
    ])

    # 3. Products
    products_col = get_collection("products")
    products = [
        {"_id": "prod_01", "workspace_id": ws_id, "name": "Apex Thermal Expedition Parka", "sku": "AW-PRK-BLK-L", "price": 185.0, "inventory_count": 42},
        {"_id": "prod_02", "workspace_id": ws_id, "name": "Merino Wool Trail Hoodie", "sku": "AW-HD-GRY-M", "price": 98.0, "inventory_count": 88},
        {"_id": "prod_03", "workspace_id": ws_id, "name": "Everyday Carry 28L Backpack", "sku": "AW-BP-NVY", "price": 145.0, "inventory_count": 30},
        {"_id": "prod_04", "workspace_id": ws_id, "name": "Waterproof Commuter Shell", "sku": "AW-SHL-OLV-XL", "price": 130.0, "inventory_count": 55},
        {"_id": "prod_05", "workspace_id": ws_id, "name": "Technical Running Shorts", "sku": "AW-SH-BLK-M", "price": 58.0, "inventory_count": 120}
    ]
    await products_col.insert_many(products)

    # 4. Customers
    cust_col = get_collection("customers")
    customers = [
        {
            "_id": "cust_eleanor",
            "workspace_id": ws_id,
            "name": "Eleanor Vance",
            "email": "eleanor.vance@gmail.com",
            "phone": "+1 (555) 234-5678",
            "total_spent": 485.50,
            "orders_count": 4,
            "sentiment_score": 0.15,
            "is_vip": True,
            "tags": ["vip", "high_ltv", "churn_risk"],
            "notes": "Longtime customer since 2023. Preparing for winter excursion; sensitive to delivery delays.",
            "created_at": datetime.utcnow() - timedelta(days=120)
        },
        {
            "_id": "cust_marcus",
            "workspace_id": ws_id,
            "name": "Marcus Sterling",
            "email": "marcus.sterling@corporate.org",
            "phone": "+1 (555) 876-5432",
            "total_spent": 620.00,
            "orders_count": 5,
            "sentiment_score": 0.2,
            "is_vip": True,
            "tags": ["vip", "platinum_buyer"],
            "notes": "Corporate executive, frequent bulk orders for company retreats.",
            "created_at": datetime.utcnow() - timedelta(days=200)
        },
        {
            "_id": "cust_olivia",
            "workspace_id": ws_id,
            "name": "Olivia Bennett",
            "email": "olivia.bennett@yahoo.com",
            "phone": "+1 (555) 456-7890",
            "total_spent": 145.00,
            "orders_count": 1,
            "sentiment_score": 0.6,
            "is_vip": False,
            "tags": ["first_time_buyer"],
            "notes": "Interested in sizing and care guidelines.",
            "created_at": datetime.utcnow() - timedelta(days=14)
        },
        {
            "_id": "cust_liam",
            "workspace_id": ws_id,
            "name": "Liam Gallagher",
            "email": "liam.gallagher@music.co.uk",
            "phone": "+1 (555) 345-6789",
            "total_spent": 98.00,
            "orders_count": 1,
            "sentiment_score": 0.45,
            "is_vip": False,
            "tags": ["standard"],
            "notes": "Tracking inquiry regarding standard ground transit.",
            "created_at": datetime.utcnow() - timedelta(days=8)
        },
        {
            "_id": "cust_sophia",
            "workspace_id": ws_id,
            "name": "Sophia Rodriguez",
            "email": "sophia.rodriguez@techhub.io",
            "phone": "+1 (555) 987-6543",
            "total_spent": 245.00,
            "orders_count": 2,
            "sentiment_score": 0.85,
            "is_vip": True,
            "tags": ["vip", "satisfied"],
            "notes": "Smooth return experience previously, enthusiastic brand supporter.",
            "created_at": datetime.utcnow() - timedelta(days=60)
        },
        {
            "_id": "cust_james",
            "workspace_id": ws_id,
            "name": "James Wilson",
            "email": "james.wilson@freemail.com",
            "phone": "+1 (555) 654-3210",
            "total_spent": 58.00,
            "orders_count": 1,
            "sentiment_score": 0.7,
            "is_vip": False,
            "tags": ["standard"],
            "notes": "Proactive delay resolution accepted.",
            "created_at": datetime.utcnow() - timedelta(days=22)
        }
    ]
    await cust_col.insert_many(customers)

    # 5. Orders
    orders_col = get_collection("orders")
    orders = [
        {
            "_id": "ord_9101",
            "workspace_id": ws_id,
            "customer_id": "cust_eleanor",
            "order_number": "ORD-9101",
            "status": "delayed",
            "items": [{"sku": "AW-PRK-BLK-L", "name": "Apex Thermal Expedition Parka", "quantity": 1, "price": 185.0}],
            "total_amount": 185.0,
            "shipping_address": {"street": "452 Mountain View Rd", "city": "Denver", "state": "CO", "zip_code": "80202", "country": "United States"},
            "tracking_number": "FDX-88291048",
            "carrier": "FedEx Ground",
            "estimated_delivery": "Nov 16, 2026 (Delayed 3 days)",
            "credits_issued": 0.0,
            "rma_labels": [],
            "created_at": datetime.utcnow() - timedelta(days=5)
        },
        {
            "_id": "ord_8820",
            "workspace_id": ws_id,
            "customer_id": "cust_marcus",
            "order_number": "ORD-8820",
            "status": "in_transit",
            "items": [{"sku": "AW-BP-NVY", "name": "Everyday Carry 28L Backpack", "quantity": 2, "price": 145.0}],
            "total_amount": 290.0,
            "shipping_address": {"street": "100 Wall Street Ste 2400", "city": "New York", "state": "NY", "zip_code": "10005", "country": "United States"},
            "tracking_number": "FDX-77401928",
            "carrier": "FedEx Express",
            "estimated_delivery": "Nov 14, 2026",
            "credits_issued": 0.0,
            "rma_labels": [],
            "created_at": datetime.utcnow() - timedelta(days=2)
        },
        {
            "_id": "ord_8540",
            "workspace_id": ws_id,
            "customer_id": "cust_olivia",
            "order_number": "ORD-8540",
            "status": "unfulfilled",
            "items": [{"sku": "AW-BP-NVY", "name": "Everyday Carry 28L Backpack", "quantity": 1, "price": 145.0}],
            "total_amount": 145.0,
            "shipping_address": {"street": "12 Pine Street Apt 4B", "city": "Seattle", "state": "WA", "zip_code": "98101", "country": "United States"},
            "tracking_number": None,
            "carrier": None,
            "estimated_delivery": "Pending warehouse packing",
            "credits_issued": 0.0,
            "rma_labels": [],
            "created_at": datetime.utcnow() - timedelta(hours=6)
        },
        {
            "_id": "ord_8120",
            "workspace_id": ws_id,
            "customer_id": "cust_sophia",
            "order_number": "ORD-8120",
            "status": "delivered",
            "items": [{"sku": "AW-SHL-OLV-XL", "name": "Waterproof Commuter Shell", "quantity": 1, "price": 130.0}],
            "total_amount": 130.0,
            "shipping_address": {"street": "88 Mission Bay Blvd", "city": "San Francisco", "state": "CA", "zip_code": "94158", "country": "United States"},
            "tracking_number": "USPS-9400111899",
            "carrier": "USPS Priority",
            "estimated_delivery": "Delivered Nov 06, 2026",
            "delivered_at": (datetime.utcnow() - timedelta(days=7)).isoformat(),
            "credits_issued": 0.0,
            "rma_labels": [
                {
                    "label_id": "RMA-77B901C2",
                    "created_at": datetime.utcnow() - timedelta(days=1),
                    "tracking_number": "USPS-RET-940022819",
                    "carrier": "USPS Return Service",
                    "status": "active",
                    "item_skus": ["AW-SHL-OLV-XL"]
                }
            ],
            "created_at": datetime.utcnow() - timedelta(days=12)
        },
        {
            "_id": "ord_7910",
            "workspace_id": ws_id,
            "customer_id": "cust_liam",
            "order_number": "ORD-7910",
            "status": "in_transit",
            "items": [{"sku": "AW-HD-GRY-M", "name": "Merino Wool Trail Hoodie", "quantity": 1, "price": 98.0}],
            "total_amount": 98.0,
            "shipping_address": {"street": "77 Sunset Blvd", "city": "Los Angeles", "state": "CA", "zip_code": "90028", "country": "United States"},
            "tracking_number": "UPS-1Z99999999",
            "carrier": "UPS Ground",
            "estimated_delivery": "Nov 15, 2026",
            "credits_issued": 0.0,
            "rma_labels": [],
            "created_at": datetime.utcnow() - timedelta(days=3)
        }
    ]
    await orders_col.insert_many(orders)

    # 6. Policy Sections (RAG Knowledge Base)
    policies_col = get_collection("policy_sections")
    policies = [
        {
            "_id": "pol_01",
            "workspace_id": ws_id,
            "title": "30-Day Return & RMA Authorization Policy",
            "category": "returns",
            "summary": "Full refund within 30 days of delivery. Items must be unworn with original tags. Prepaid USPS RMA label provided.",
            "content": (
                "Customers are eligible for a full refund or exchange within 30 days of confirmed delivery date. "
                "All returned merchandise must be in original unworn condition with tags attached. "
                "SupportPilot AI is authorized to automatically generate a prepaid USPS return authorization (RMA) label "
                "for all delivered orders within this 30-day window. Items delivered past 30 days are non-returnable unless covered by warranty."
            ),
            "tags": ["returns", "rma", "refund", "return_label", "exchange", "30_days"],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "pol_02",
            "workspace_id": ws_id,
            "title": "Pre-Dispatch Shipping Address Change Policy",
            "category": "shipping",
            "summary": "Address updates permitted strictly before fulfillment (unfulfilled). Once in transit, modification is locked.",
            "content": (
                "Destination shipping addresses can be modified strictly prior to warehouse fulfillment while order status is 'unfulfilled'. "
                "Once an order enters 'in_transit' or 'delivered' status, address modifications cannot be processed autonomously due to carrier manifests. "
                "If the package is already with the carrier, the customer must be instructed to utilize carrier parcel intercept or local hold."
            ),
            "tags": ["address_change", "shipping_address", "pre_dispatch", "reroute", "destination"],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "pol_03",
            "workspace_id": ws_id,
            "title": "Carrier Delay Compensation & Courtesy Credits",
            "category": "shipping",
            "summary": "Proactive $15 courtesy store credit issued when carrier delay exceeds 48 hours past estimated delivery.",
            "content": (
                "When a shipment encounters a verified carrier delay of 48 hours or more beyond original ETA, SupportPilot AI is permitted "
                "to autonomously issue a $15.00 courtesy store credit to the customer account. The AI agent must express genuine regret, "
                "provide the updated carrier tracking link, and reassure the customer of expedited tracking monitoring."
            ),
            "tags": ["delay", "shipping_delay", "carrier_exception", "compensation", "courtesy_credit", "late_delivery"],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "pol_04",
            "workspace_id": ws_id,
            "title": "Store Credit Goodwill & Hard Cap Protocol",
            "category": "store_credit",
            "summary": "Hard cap of $50.00 maximum store credit per order. Cannot exceed item or order total value.",
            "content": (
                "For damaged packaging, minor manufacturing defects, or service inconveniences, the AI agent may issue store credit up to $25.00 autonomously. "
                "Any credit request exceeding $25.00 up to the hard ceiling of $50.00 strictly requires human agent approval in the 'Needs Approval' queue. "
                "Under no circumstances may automated or human credit exceed $50.00 per single order transaction."
            ),
            "tags": ["store_credit", "goodwill", "cap", "compensation", "credit_limit", "discount"],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "pol_05",
            "workspace_id": ws_id,
            "title": "VIP Customer Retention & Churn Prevention Protocol",
            "category": "escalations",
            "summary": "Customers with LTV > $200 exhibiting negative sentiment trigger VIP_CHURN_RISK escalation to human supervisors.",
            "content": (
                "Customers with cumulative spend exceeding $200.00 who express negative sentiment, frustration, or threats of defection "
                "must be immediately classified as VIP_CHURN_RISK. Automated replies are halted, and the ticket is escalated to the VIP / Critical "
                "queue with a 3-bullet structured summary highlighting LTV, specific grievance, and recommended high-touch concession."
            ),
            "tags": ["vip", "churn_risk", "escalation", "high_ltv", "urgent", "supervisor"],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "pol_06",
            "workspace_id": ws_id,
            "title": "Payment Failure Recovery Policy",
            "category": "payments",
            "summary": "Failed payments require secure in-app recovery without collecting card data in support messages.",
            "content": "When a payment fails, create a proactive in-app notification and support ticket. Direct the customer to the secure checkout to update payment details. Never request or store raw card numbers in a ticket or support message.",
            "tags": ["payment", "payment_failed", "card", "recovery", "security"],
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    ]
    await policies_col.insert_many(policies)

    # 7. Tickets & Messages
    tickets_col = get_collection("tickets")
    messages_col = get_collection("messages")
    audit_col = get_collection("audit_traces")
    feedback_col = get_collection("edit_feedback")

    # Ticket 1: Needs Approval (Gated Action - Address Change on In-Transit Order)
    t1_id = "tick_addr_gate_01"
    await tickets_col.insert_one({
        "_id": t1_id,
        "workspace_id": ws_id,
        "customer_id": "cust_marcus",
        "order_id": "ord_8820",
        "title": "Request to change delivery address for ORD-8820",
        "status": "needs_approval",
        "priority": "high",
        "channel": "email",
        "intent": "address_change",
        "sentiment": "negative",
        "urgency": "high",
        "ai_confidence": 0.88,
        "is_vip": True,
        "vip_churn_risk": False,
        "requires_approval": True,
        "escalation_summary": {
            "bullets": [
                "Customer Profile: Marcus Sterling (VIP Tier - $620.00 LTV)",
                "Detected Issue: Customer requested address change to 45 Park Ave, but ORD-8820 is already 'in_transit' with FedEx Express.",
                "Recommended Next Step: Guardrail blocked autonomous update. Agent should contact FedEx dispatch for intercept or offer return & reship."
            ],
            "trigger_reason": "Order ORD-8820 is already in transit; pre-dispatch guardrail prevented auto-write.",
            "recommended_action": "Contact carrier for parcel intercept or explain hold options to customer."
        },
        "proposed_action": {
            "action_type": "update_shipping_address",
            "parameters": {
                "order_number": "ORD-8820",
                "shipping_address": {"street": "45 Park Ave Ste 12", "city": "New York", "state": "NY", "zip_code": "10016", "country": "United States"}
            },
            "status": "pending_approval",
            "reason": "Address change rejected by deterministic guardrail: Order ORD-8820 is currently in_transit."
        },
        "ai_draft_reply": (
            "Hello Marcus,\n\n"
            "Thank you for contacting us. We checked order ORD-8820 right away. "
            "Because your order was dispatched earlier today via FedEx Express (tracking FDX-77401928), our automated system cannot modify the shipping label in transit.\n\n"
            "Our support team is reviewing your file to initiate a carrier delivery redirect or arrange a FedEx Hold at Location for your convenience."
        ),
        "citations": [
            {"section_id": "pol_02", "title": "Pre-Dispatch Shipping Address Change Policy", "relevance_score": 0.94, "snippet": "Destination shipping addresses can be modified strictly prior to warehouse fulfillment while order status is 'unfulfilled'."}
        ],
        "created_at": datetime.utcnow() - timedelta(hours=3),
        "updated_at": datetime.utcnow() - timedelta(hours=1)
    })

    await messages_col.insert_many([
        {
            "_id": "msg_01_a",
            "workspace_id": ws_id,
            "ticket_id": t1_id,
            "sender_type": "customer",
            "sender_name": "Marcus Sterling",
            "content": "Hi, I made a mistake on my shipping address for order ORD-8820! I need it sent to 45 Park Ave Ste 12, New York NY 10016 instead of Wall St. Please fix this immediately.",
            "pii_redacted_content": "Hi, I made a mistake on my shipping address for order ORD-8820! I need it sent to 45 Park Ave Ste 12, New York NY 10016 instead of Wall St. Please fix this immediately.",
            "citations": [],
            "created_at": datetime.utcnow() - timedelta(hours=3)
        }
    ])

    # Ticket 2: VIP / Critical Queue (VIP_CHURN_RISK - Delayed Parka for Winter Trip)
    t2_id = "tick_vip_churn_02"
    await tickets_col.insert_one({
        "_id": t2_id,
        "workspace_id": ws_id,
        "customer_id": "cust_eleanor",
        "order_id": "ord_9101",
        "title": "URGENT: Order ORD-9101 is 3 days late, trip is tomorrow!",
        "status": "needs_approval",
        "priority": "urgent",
        "channel": "email",
        "intent": "shipping_delay",
        "sentiment": "frustrated",
        "urgency": "urgent",
        "ai_confidence": 0.74,
        "is_vip": True,
        "vip_churn_risk": True,
        "requires_approval": True,
        "escalation_summary": {
            "bullets": [
                "Customer Profile: Eleanor Vance (VIP Tier - $485.50 LTV across 4 prior orders)",
                "Detected Issue: Apex Thermal Parka delayed 3 days due to FedEx regional weather exception; customer leaves tomorrow for mountain excursion.",
                "Recommended Next Step: High churn risk! Human agent should approve expedited Saturday courier or issue $35 store credit + personal apology."
            ],
            "trigger_reason": "VIP Customer with negative sentiment and time-sensitive travel risk (VIP_CHURN_RISK)",
            "recommended_action": "Review carrier status, offer immediate $25-$35 goodwill credit and express delivery follow-up."
        },
        "proposed_action": {
            "action_type": "issue_store_credit",
            "parameters": {"amount": 25.0, "reason": "VIP churn mitigation courtesy for ORD-9101 delay"},
            "status": "pending_approval",
            "reason": "Requires human agent approval under VIP retention policy."
        },
        "ai_draft_reply": (
            "Dear Eleanor,\n\n"
            "I sincerely apologize for the delay with your Apex Thermal Parka (ORD-9101). "
            "We understand how vital this is with your winter trip scheduled tomorrow.\n\n"
            "We are coordinating directly with our FedEx priority desk to expedite delivery today. "
            "Additionally, we have credited $25.00 to your account as a token of our commitment to you as one of our most valued customers."
        ),
        "citations": [
            {"section_id": "pol_03", "title": "Carrier Delay Compensation & Courtesy Credits", "relevance_score": 0.95, "snippet": "When a shipment encounters a verified carrier delay of 48 hours or more beyond original ETA..."},
            {"section_id": "pol_05", "title": "VIP Customer Retention & Churn Prevention Protocol", "relevance_score": 0.91, "snippet": "Customers with cumulative spend exceeding $200.00 who express negative sentiment..."}
        ],
        "created_at": datetime.utcnow() - timedelta(hours=4),
        "updated_at": datetime.utcnow() - timedelta(hours=2)
    })

    await messages_col.insert_many([
        {
            "_id": "msg_02_a",
            "workspace_id": ws_id,
            "ticket_id": t2_id,
            "sender_type": "customer",
            "sender_name": "Eleanor Vance",
            "content": "This is completely unacceptable. My order ORD-9101 was supposed to be here Tuesday. I am flying out tomorrow for Aspen and have no winter coat. I've spent nearly $500 with you guys. If this isn't solved today I am canceling my account.",
            "pii_redacted_content": "This is completely unacceptable. My order ORD-9101 was supposed to be here Tuesday. I am flying out tomorrow for Aspen and have no winter coat. I've spent nearly $500 with you guys. If this isn't solved today I am canceling my account.",
            "citations": [],
            "created_at": datetime.utcnow() - timedelta(hours=4)
        }
    ])

    # Ticket 3: Resolved (Autonomous AI Auto-Pilot Deflection - RMA Return Label)
    t3_id = "tick_rma_deflected_03"
    await tickets_col.insert_one({
        "_id": t3_id,
        "workspace_id": ws_id,
        "customer_id": "cust_sophia",
        "order_id": "ord_8120",
        "title": "Return request for Commuter Shell in order ORD-8120",
        "status": "resolved",
        "priority": "low",
        "channel": "email",
        "intent": "return_rma",
        "sentiment": "positive",
        "urgency": "low",
        "ai_confidence": 0.96,
        "is_vip": True,
        "vip_churn_risk": False,
        "requires_approval": False,
        "ai_draft_reply": None,
        "citations": [
            {"section_id": "pol_01", "title": "30-Day Return & RMA Authorization Policy", "relevance_score": 0.98, "snippet": "Customers are eligible for a full refund or exchange within 30 days of confirmed delivery date."}
        ],
        "created_at": datetime.utcnow() - timedelta(days=1),
        "updated_at": datetime.utcnow() - timedelta(days=1)
    })

    await messages_col.insert_many([
        {
            "_id": "msg_03_a",
            "workspace_id": ws_id,
            "ticket_id": t3_id,
            "sender_type": "customer",
            "sender_name": "Sophia Rodriguez",
            "content": "Hi! The Commuter Shell from order ORD-8120 fits a bit too loose on me. May I please return it for a size smaller or refund?",
            "pii_redacted_content": "Hi! The Commuter Shell from order ORD-8120 fits a bit too loose on me. May I please return it for a size smaller or refund?",
            "citations": [],
            "created_at": datetime.utcnow() - timedelta(days=1, hours=2)
        },
        {
            "_id": "msg_03_b",
            "workspace_id": ws_id,
            "ticket_id": t3_id,
            "sender_type": "ai",
            "sender_name": "SupportPilot AI",
            "content": (
                "Hello Sophia,\n\n"
                "We are happy to assist you with your return! Under our 30-Day Return Policy, your order ORD-8120 is fully eligible for a prepaid return label.\n\n"
                "We have automatically generated your return merchandise authorization (RMA-77B901C2) and prepaid USPS return label (USPS-RET-940022819). "
                "You can print the label directly from your account or attach the QR code at your nearest USPS drop-off.\n\n"
                "Once scanned by the carrier, your exchange or full refund will process within 48 hours."
            ),
            "citations": [
                {"section_id": "pol_01", "title": "30-Day Return & RMA Authorization Policy", "relevance_score": 0.98, "snippet": "Customers are eligible for a full refund or exchange within 30 days..."}
            ],
            "confidence_score": 0.96,
            "created_at": datetime.utcnow() - timedelta(days=1, hours=1, minutes=58)
        }
    ])

    # Prepopulate edit feedback for analytics
    await feedback_col.insert_many([
        {
            "_id": "fb_01",
            "workspace_id": ws_id,
            "ticket_id": t3_id,
            "agent_id": "usr_agent_01",
            "agent_name": "Sarah Jenkins",
            "original_draft": "Hello Sophia, your RMA is ready.",
            "edited_draft": "Hello Sophia, your RMA is ready.",
            "edit_distance": 0,
            "edit_ratio": 0.0,
            "action_decision": "approved",
            "created_at": datetime.utcnow() - timedelta(days=1)
        },
        {
            "_id": "fb_02",
            "workspace_id": ws_id,
            "ticket_id": "tick_prev_02",
            "agent_id": "usr_agent_01",
            "agent_name": "Sarah Jenkins",
            "original_draft": "We have credited $10 to your account.",
            "edited_draft": "We have credited $15 to your account along with complimentary 2-day shipping on your next order.",
            "edit_distance": 45,
            "edit_ratio": 0.4,
            "action_decision": "edited_and_approved",
            "created_at": datetime.utcnow() - timedelta(days=2)
        }
    ])

    # 8. Notifications
    notif_col = get_collection("notifications")
    await notif_col.insert_many([
        {
            "_id": "notif_01",
            "workspace_id": ws_id,
            "title": "VIP Churn Risk Escalated",
            "message": "Eleanor Vance (LTV $485.50) reported carrier delay on ORD-9101 with frustrated sentiment.",
            "type": "urgent",
            "read": False,
            "link": f"/tickets/{t2_id}",
            "created_at": datetime.utcnow() - timedelta(hours=4)
        },
        {
            "_id": "notif_02",
            "workspace_id": ws_id,
            "title": "Approval Required: Guardrail Gated Action",
            "message": "Order ORD-8820 shipping address update blocked by pre-dispatch guardrail.",
            "type": "warning",
            "read": False,
            "link": f"/tickets/{t1_id}",
            "created_at": datetime.utcnow() - timedelta(hours=3)
        },
        {
            "_id": "notif_03",
            "workspace_id": ws_id,
            "title": "Autonomous Deflection Successful",
            "message": "SupportPilot AI resolved RMA return request for Sophia Rodriguez (ORD-8120) with 96% confidence.",
            "type": "success",
            "read": True,
            "link": f"/tickets/{t3_id}",
            "created_at": datetime.utcnow() - timedelta(days=1)
        }
    ])

    # 9. Automation Rules
    rules_col = get_collection("automation_rules")
    await rules_col.insert_many([
        {
            "_id": "rule_delay_webhook",
            "workspace_id": ws_id,
            "name": "Carrier Delay Proactive Outreach",
            "description": "Trigger proactive notification and $15 goodwill credit when carrier reports transit delay.",
            "trigger_event": "shipment.delayed",
            "conditions": {"delay_hours_min": 48},
            "actions": [
                {"type": "create_ticket", "priority": "high"},
                {"type": "issue_courtesy_credit", "amount": 15.0},
                {"type": "send_proactive_email", "template": "shipping_delay_apology"}
            ],
            "is_active": True,
            "execution_count": 8,
            "created_at": datetime.utcnow() - timedelta(days=30),
            "last_triggered_at": datetime.utcnow() - timedelta(days=1)
        },
        {
            "_id": "rule_vip_detection",
            "workspace_id": ws_id,
            "name": "VIP Churn Risk Auto-Escalation",
            "description": "Automatically route tickets from customers with > $200 spend and negative sentiment to the VIP / Critical queue.",
            "trigger_event": "customer.inquiry",
            "conditions": {"min_total_spent": 200.0, "sentiments": ["negative", "frustrated"]},
            "actions": [
                {"type": "tag_ticket", "tag": "VIP_CHURN_RISK"},
                {"type": "set_priority", "priority": "urgent"},
                {"type": "require_human_approval"}
            ],
            "is_active": True,
            "execution_count": 14,
            "created_at": datetime.utcnow() - timedelta(days=30),
            "last_triggered_at": datetime.utcnow() - timedelta(hours=4)
        }
    ])

    print("[Seed] Seed data successfully populated.")
