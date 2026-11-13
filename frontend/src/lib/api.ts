import {
  User,
  OverviewMetrics,
  Ticket,
  Order,
  Customer,
  PolicySection,
  AutomationRule,
  AppNotification,
  AuditTrace,
  Workspace,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private idempotencyKey(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  private getToken(): string | null {
    return localStorage.getItem('supportpilot_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    workspace_name?: string;
  }): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me');
  }

  // Overview
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    return this.request('/overview/metrics');
  }

  // Tickets
  async getTickets(params?: { queue?: string; status?: string; priority?: string; search?: string }): Promise<Ticket[]> {
    const searchParams = new URLSearchParams();
    if (params?.queue) searchParams.set('queue', params.queue);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    return this.request(`/tickets${query ? `?${query}` : ''}`);
  }

  async getTicket(id: string): Promise<Ticket> {
    return this.request(`/tickets/${id}`);
  }

  async createTicket(data: { customer_id: string; title: string; message: string; order_id?: string; channel?: string }): Promise<Ticket> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addMessage(ticketId: string, content: string, senderType: string = 'agent', senderName?: string): Promise<any> {
    return this.request(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, sender_type: senderType, sender_name: senderName }),
    });
  }

  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket> {
    return this.request(`/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Approval
  async getApprovalQueue(): Promise<Ticket[]> {
    return this.request('/approval/queue');
  }

  async approveTicket(ticketId: string, executeAction: boolean = true): Promise<any> {
    return this.request(`/approval/${ticketId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ execute_action: executeAction }),
    });
  }

  async editAndApproveTicket(ticketId: string, editedReply: string, modifiedAction?: any, executeAction: boolean = true): Promise<any> {
    return this.request(`/approval/${ticketId}/edit-and-approve`, {
      method: 'POST',
      body: JSON.stringify({ edited_reply: editedReply, modified_action: modifiedAction, execute_action: executeAction }),
    });
  }

  async rejectTicket(ticketId: string, reason: string): Promise<any> {
    return this.request(`/approval/${ticketId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Customers
  async getCustomers(search?: string, vipOnly: boolean = false): Promise<Customer[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (vipOnly) params.set('vip_only', 'true');
    const q = params.toString();
    return this.request(`/customers${q ? `?${q}` : ''}`);
  }

  async getCustomer(id: string): Promise<Customer & { orders: Order[]; tickets: Ticket[] }> {
    return this.request(`/customers/${id}`);
  }

  // Orders
  async getOrders(search?: string, status?: string): Promise<Order[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const q = params.toString();
    return this.request(`/orders${q ? `?${q}` : ''}`);
  }

  async getOrder(id: string): Promise<Order> {
    return this.request(`/orders/${id}`);
  }

  async updateOrderAddress(orderId: string, shippingAddress: any, idempotencyKey?: string): Promise<any> {
    return this.request(`/orders/${orderId}/update-address`, {
      method: 'POST',
      body: JSON.stringify({ shipping_address: shippingAddress, idempotency_key: idempotencyKey || this.idempotencyKey('address') }),
    });
  }

  async issueStoreCredit(orderId: string, amount: number, reason: string, idempotencyKey?: string): Promise<any> {
    return this.request(`/orders/${orderId}/store-credit`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason, idempotency_key: idempotencyKey || this.idempotencyKey('credit') }),
    });
  }

  async generateRMALabel(orderId: string, reason: string, itemSkus?: string[], idempotencyKey?: string): Promise<any> {
    return this.request(`/orders/${orderId}/rma`, {
      method: 'POST',
      body: JSON.stringify({ reason, item_skus: itemSkus, idempotency_key: idempotencyKey || this.idempotencyKey('rma') }),
    });
  }

  // Agent
  async getAgentStatus(): Promise<any> {
    return this.request('/agent/status');
  }

  async testInquiry(message: string, customerId?: string, orderId?: string): Promise<any> {
    return this.request('/agent/test-inquiry', {
      method: 'POST',
      body: JSON.stringify({ message, customer_id: customerId, order_id: orderId }),
    });
  }

  async getAuditTraces(ticketId?: string): Promise<AuditTrace[]> {
    return this.request(`/agent/audit-traces${ticketId ? `?ticket_id=${ticketId}` : ''}`);
  }

  // Knowledge Base
  async getPolicies(category?: string): Promise<PolicySection[]> {
    return this.request(`/knowledge-base/policies${category ? `?category=${category}` : ''}`);
  }

  async createPolicy(policy: Partial<PolicySection>): Promise<PolicySection> {
    return this.request('/knowledge-base/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }

  async updatePolicy(id: string, updates: Partial<PolicySection>): Promise<PolicySection> {
    return this.request(`/knowledge-base/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deletePolicy(id: string): Promise<any> {
    return this.request(`/knowledge-base/policies/${id}`, {
      method: 'DELETE',
    });
  }

  async testRAG(query: string): Promise<any> {
    return this.request('/knowledge-base/test-rag', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Automations
  async getRules(): Promise<AutomationRule[]> {
    return this.request('/automations/rules');
  }

  async toggleRule(ruleId: string): Promise<AutomationRule> {
    return this.request(`/automations/rules/${ruleId}/toggle`, {
      method: 'PATCH',
    });
  }

  // Analytics
  async getAnalyticsSummary(): Promise<any> {
    return this.request('/analytics/summary');
  }

  // Settings
  async getWorkspaceSettings(): Promise<Workspace> {
    return this.request('/settings/workspace');
  }

  async updateWorkspaceSettings(data: { name?: string; settings: any }): Promise<Workspace> {
    return this.request('/settings/workspace', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Webhooks & Proactive
  async simulateCarrierDelay(): Promise<any> {
    return this.request('/webhooks/simulate-delay', {
      method: 'POST',
    });
  }

  // Notifications
  async getNotifications(): Promise<AppNotification[]> {
    return this.request('/notifications');
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
