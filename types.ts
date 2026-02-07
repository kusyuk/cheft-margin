
export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentMarketPrice: number;
  basePrice: number;
  currentStock: number;
  supplierName?: string;
  supplierContact?: string;
}

export interface RecipeItem {
  ingredientId: string;
  qty: number;
}

export interface MenuItem {
  id: string;
  name: string;
  sellingPrice: number;
  ingredients: RecipeItem[];
}

export interface OrderItem {
  menuItemId: string;
  qty: number;
}

export interface Sale {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'ONLINE';
}

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  SEATED = 'SEATED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Reservation {
  id: string;
  customerName: string;
  pax: number;
  date: string; // YYYY-MM-DD
  time: string;
  status: ReservationStatus;
  orders: OrderItem[];
  notes?: string;
}

export enum AlertType {
  STOCKOUT = 'STOCKOUT',
  MARGIN = 'MARGIN'
}

export enum Severity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM'
}

export interface AIAlert {
  type: AlertType;
  item_name: string;
  severity: Severity;
  message: string;
  suggested_action: string;
}

export interface ProcurementItem {
  ingredient: string;
  required_qty: number;
  current_qty: number;
  to_buy: number;
}

export type QuickActionType = 'SUPPLIER_EMAIL' | 'PRICE_UPDATE';

export interface QuickAction {
  type: QuickActionType;
  title: string;
  reason: string;
  // Fields for Email Action
  email_recipient?: string;
  email_subject?: string;
  email_body?: string;
  // Fields for Price Action
  menu_item_name?: string;
  suggested_price?: number;
}

export interface AIAnalysisResponse {
  analysis_summary: string;
  alerts: AIAlert[];
  procurement_list: ProcurementItem[];
  quick_actions: QuickAction[];
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  dateRange: { start: string; end: string };
  result: AIAnalysisResponse;
}

export interface ParsedInvoiceItem {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

export interface ParsedInvoice {
  supplierName: string;
  items: ParsedInvoiceItem[];
}