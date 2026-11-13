export type TicketStatus = 'open' | 'needs_approval' | 'resolved' | 'escalated' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';
export type SenderType = 'customer' | 'agent' | 'ai' | 'system';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'agent' | 'viewer' | 'customer';
  workspace_id: string;
  customer_id?: string;
  created_at: string;
}

export interface WorkspaceSettings {
  confidence_threshold: number;
  store_credit_max_cap: number;
  auto_pilot_enabled: boolean;
  delay_compensation_credit: number;
  gemini_model: string;
  simulated_carrier: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  settings: WorkspaceSettings;
}

export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  phone?: string;
  total_spent: number;
  orders_count: number;
  average_order_value: number;
  sentiment_score: number;
  is_vip: boolean;
  tags: string[];
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface RMALabel {
  label_id: string;
  tracking_number: string;
  carrier: string;
  status: string;
  item_skus: string[];
  created_at: string;
}

export interface Order {
  id: string;
  workspace_id: string;
  customer_id: string;
  order_number: string;
  status: 'unfulfilled' | 'fulfilled' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  items: OrderItem[];
  total_amount: number;
  shipping_address: ShippingAddress;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery?: string;
  credits_issued: number;
  rma_labels: RMALabel[];
  customer_name?: string;
  customer_email?: string;
  created_at: string;
}

export interface PolicyCitation {
  section_id: string;
  title: string;
  relevance_score: number;
  snippet: string;
}

export interface ProposedAction {
  action_type: 'update_shipping_address' | 'issue_store_credit' | 'generate_rma_label' | 'escalate_ticket';
  parameters: Record<string, any>;
  status: 'pending_approval' | 'executed' | 'rejected' | 'approved';
  reason?: string;
  executed_at?: string;
}

export interface EscalationSummary {
  bullets: string[];
  trigger_reason: string;
  recommended_action: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_name: string;
  content: string;
  pii_redacted_content?: string;
  citations: PolicyCitation[];
  confidence_score?: number;
  created_at: string;
}

export interface ExecutionStep {
  step_name: string;
  status: 'success' | 'warning' | 'failed' | 'skipped';
  details: Record<string, any>;
  timestamp: string;
}

export interface AuditTrace {
  id: string;
  workspace_id: string;
  ticket_id: string;
  trigger: string;
  intent?: string;
  sentiment?: string;
  urgency?: string;
  pii_redacted: boolean;
  redacted_items_count: number;
  order_looked_up?: string;
  policies_cited: string[];
  confidence_score: number;
  guardrails_passed: boolean;
  guardrail_details: string[];
  selected_action?: string;
  action_parameters?: Record<string, any>;
  action_status: string;
  execution_steps: ExecutionStep[];
  escalation_reason?: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  workspace_id: string;
  customer_id: string;
  order_id?: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: string;
  intent?: string;
  sentiment?: Sentiment;
  urgency?: string;
  ai_confidence?: number;
  is_vip: boolean;
  vip_churn_risk: boolean;
  requires_approval: boolean;
  escalation_summary?: EscalationSummary;
  proposed_action?: ProposedAction;
  ai_draft_reply?: string;
  citations: PolicyCitation[];
  customer_name?: string;
  customer_email?: string;
  customer_spent?: number;
  customer?: Customer;
  order?: Order;
  messages?: Message[];
  audit_trace?: AuditTrace;
  created_at: string;
  updated_at: string;
}

export interface PolicySection {
  id: string;
  workspace_id: string;
  title: string;
  category: string;
  content: string;
  summary: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  trigger_event: string;
  conditions: Record<string, any>;
  actions: Record<string, any>[];
  is_active: boolean;
  execution_count: number;
  created_at: string;
  last_triggered_at?: string;
}

export interface AppNotification {
  id: string;
  workspace_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent' | 'success' | 'webhook';
  read: boolean;
  link?: string;
  created_at: string;
}

export interface OverviewMetrics {
  total_tickets: number;
  open_tickets: number;
  needs_approval: number;
  resolved_tickets: number;
  escalated_tickets: number;
  ai_deflection_rate: number;
  draft_edit_rate: number;
  estimated_hours_saved: number;
  average_response_time_minutes: number;
}
