
import { Ingredient, MenuItem, Reservation, ReservationStatus, Sale } from './types';

// Helper to generate dynamic dates based on LOCAL time to match the UI's calendar generation.
// Using manual getters guarantees we get the local YYYY-MM-DD without UTC conversions.
const getRelativeDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TODAY = getRelativeDate(0);
const TOMORROW = getRelativeDate(1);
const YESTERDAY = getRelativeDate(-1);
const TWO_DAYS_AGO = getRelativeDate(-2);
const THREE_DAYS_AGO = getRelativeDate(-3);

export const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Salmon Fillet', unit: 'kg', basePrice: 18.00, currentMarketPrice: 19.50, currentStock: 4.5, supplierName: 'Pacific Seafood Co.', supplierContact: '+1 800-FISH-NOW' },
  { id: 'i2', name: 'Avocado', unit: 'piece', basePrice: 2.50, currentMarketPrice: 3.20, currentStock: 15, supplierName: 'Green Grove Farms', supplierContact: 'orders@greengrove.com' },
  { id: 'i3', name: 'Wagyu Beef', unit: 'kg', basePrice: 75.00, currentMarketPrice: 72.00, currentStock: 3.5, supplierName: 'Heritage Meats', supplierContact: 'Sales Dept' },
  { id: 'i4', name: 'Sourdough', unit: 'loaf', basePrice: 4.50, currentMarketPrice: 4.50, currentStock: 8, supplierName: 'Artisan Bakery Inc.', supplierContact: 'daily@artisan.bakery' },
  { id: 'i5', name: 'Burger Bun', unit: 'piece', basePrice: 0.80, currentMarketPrice: 0.85, currentStock: 42, supplierName: 'Industrial Baking Group', supplierContact: 'Order Desk' },
  { id: 'i6', name: 'Limes', unit: 'piece', basePrice: 0.50, currentMarketPrice: 0.60, currentStock: 25, supplierName: 'Tropical Produce', supplierContact: 'whatsapp: +52-88-...' },
  { id: 'i7', name: 'Romaine Lettuce', unit: 'head', basePrice: 1.20, currentMarketPrice: 1.50, currentStock: 12, supplierName: 'Local Greens', supplierContact: 'farmers@market.com' },
  { id: 'i8', name: 'Parmesan Cheese', unit: 'kg', basePrice: 22.00, currentMarketPrice: 24.00, currentStock: 2, supplierName: 'Italian Imports', supplierContact: 'gio@imports.com' },
  { id: 'i9', name: 'Chicken Breast', unit: 'kg', basePrice: 9.00, currentMarketPrice: 8.50, currentStock: 10, supplierName: 'Poultry Farms', supplierContact: 'sales@chickens.com' },
  { id: 'i10', name: 'Truffle Oil', unit: 'bottle', basePrice: 18.00, currentMarketPrice: 18.00, currentStock: 4, supplierName: 'Gourmet Supplies', supplierContact: 'info@gourmet.com' },
];

export const INITIAL_MENU: MenuItem[] = [
  {
    id: 'm1',
    name: 'Grilled Salmon',
    sellingPrice: 32.00,
    ingredients: [
      { ingredientId: 'i1', qty: 0.25 }, // 250g
      { ingredientId: 'i6', qty: 1 }    // 1 lime
    ]
  },
  {
    id: 'm2',
    name: 'Avocado Toast',
    sellingPrice: 16.00,
    ingredients: [
      { ingredientId: 'i2', qty: 1 },    // 1 avocado
      { ingredientId: 'i4', qty: 0.15 }, // slice
      { ingredientId: 'i6', qty: 0.5 }   // half lime juice
    ]
  },
  {
    id: 'm3',
    name: 'Wagyu Burger',
    sellingPrice: 29.00,
    ingredients: [
      { ingredientId: 'i3', qty: 0.18 }, // 180g beef
      { ingredientId: 'i5', qty: 1 },    // 1 bun
      { ingredientId: 'i7', qty: 0.1 }   // lettuce leaf
    ]
  },
  {
    id: 'm4',
    name: 'Chicken Caesar Salad',
    sellingPrice: 22.00,
    ingredients: [
      { ingredientId: 'i7', qty: 0.5 },  // half head lettuce
      { ingredientId: 'i9', qty: 0.2 },  // 200g chicken
      { ingredientId: 'i8', qty: 0.05 }, // 50g cheese
      { ingredientId: 'i4', qty: 0.1 }   // croutons
    ]
  },
  {
    id: 'm5',
    name: 'Truffle Fries',
    sellingPrice: 12.00,
    ingredients: [
      { ingredientId: 'i10', qty: 0.01 }, // splash of oil
      { ingredientId: 'i8', qty: 0.02 }   // cheese dusting
    ]
  }
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  // TODAY
  { 
    id: 'r1', 
    customerName: 'Alice Chen', 
    pax: 2, 
    date: TODAY, 
    time: '12:30', 
    status: ReservationStatus.SEATED, 
    orders: [{ menuItemId: 'm2', qty: 2 }, { menuItemId: 'm5', qty: 1 }], 
    notes: 'Window seat preferred' 
  },
  { 
    id: 'r2', 
    customerName: 'TechCorp Lunch', 
    pax: 6, 
    date: TODAY, 
    time: '13:00', 
    status: ReservationStatus.CONFIRMED, 
    orders: [{ menuItemId: 'm3', qty: 4 }, { menuItemId: 'm4', qty: 2 }, { menuItemId: 'm5', qty: 3 }], 
    notes: 'Corporate account' 
  },
  { 
    id: 'r3', 
    customerName: 'Mr. & Mrs. Smith', 
    pax: 2, 
    date: TODAY, 
    time: '19:30', 
    status: ReservationStatus.CONFIRMED, 
    orders: [], 
    notes: 'Anniversary' 
  },
  
  // TOMORROW
  { 
    id: 'r4', 
    customerName: 'Birthday Group (Sarah)', 
    pax: 10, 
    date: TOMORROW, 
    time: '18:00', 
    status: ReservationStatus.CONFIRMED, 
    orders: [{ menuItemId: 'm1', qty: 5 }, { menuItemId: 'm3', qty: 5 }], 
    notes: 'Bringing cake' 
  },
  { 
    id: 'r5', 
    customerName: 'James Bond', 
    pax: 1, 
    date: TOMORROW, 
    time: '20:00', 
    status: ReservationStatus.CONFIRMED, 
    orders: [{ menuItemId: 'm3', qty: 1 }], 
    notes: 'Martini shaken not stirred' 
  },

  // YESTERDAY
  { 
    id: 'r6', 
    customerName: 'Early Bird Club', 
    pax: 4, 
    date: YESTERDAY, 
    time: '17:00', 
    status: ReservationStatus.COMPLETED, 
    orders: [{ menuItemId: 'm4', qty: 4 }] 
  },
  
  // OLDER
  { 
    id: 'r7', 
    customerName: 'Lunch Meeting', 
    pax: 3, 
    date: TWO_DAYS_AGO, 
    time: '12:00', 
    status: ReservationStatus.COMPLETED, 
    orders: [{ menuItemId: 'm2', qty: 3 }] 
  },
  { 
    id: 'r8', 
    customerName: 'Family Dinner', 
    pax: 5, 
    date: THREE_DAYS_AGO, 
    time: '18:30', 
    status: ReservationStatus.COMPLETED, 
    orders: [{ menuItemId: 'm1', qty: 2 }, { menuItemId: 'm3', qty: 3 }] 
  }
];

export const INITIAL_SALES: Sale[] = [
  // TODAY SALES (Active day data)
  {
    id: 's5',
    date: TODAY,
    time: '11:30',
    items: [{ menuItemId: 'm2', qty: 2 }],
    totalAmount: 32.00,
    paymentMethod: 'ONLINE'
  },
  {
    id: 's6',
    date: TODAY,
    time: '12:05',
    items: [{ menuItemId: 'm4', qty: 1 }, { menuItemId: 'm5', qty: 1 }],
    totalAmount: 34.00,
    paymentMethod: 'CASH'
  },
  {
    id: 's7',
    date: TODAY,
    time: '12:20',
    items: [{ menuItemId: 'm3', qty: 1 }],
    totalAmount: 29.00,
    paymentMethod: 'CARD'
  },
  {
    id: 's8',
    date: TODAY,
    time: '12:45',
    items: [{ menuItemId: 'm1', qty: 1 }, { menuItemId: 'm2', qty: 1 }],
    totalAmount: 48.00,
    paymentMethod: 'CARD'
  },

  // YESTERDAY SALES
  {
    id: 's1',
    date: YESTERDAY,
    time: '12:15',
    items: [{ menuItemId: 'm3', qty: 2 }, { menuItemId: 'm5', qty: 1 }],
    totalAmount: 70.00,
    paymentMethod: 'CARD'
  },
  {
    id: 's2',
    date: YESTERDAY,
    time: '12:45',
    items: [{ menuItemId: 'm2', qty: 1 }, { menuItemId: 'm4', qty: 1 }],
    totalAmount: 38.00,
    paymentMethod: 'CASH'
  },
  {
    id: 's3',
    date: YESTERDAY,
    time: '13:30',
    items: [{ menuItemId: 'm1', qty: 1 }, { menuItemId: 'm4', qty: 2 }],
    totalAmount: 76.00,
    paymentMethod: 'CARD'
  },
  {
    id: 's4',
    date: YESTERDAY,
    time: '19:15',
    items: [{ menuItemId: 'm3', qty: 4 }, { menuItemId: 'm5', qty: 4 }, { menuItemId: 'm1', qty: 2 }],
    totalAmount: 228.00,
    paymentMethod: 'CARD'
  },
  
  // OLDER SALES
  {
    id: 's9',
    date: TWO_DAYS_AGO,
    time: '19:00',
    items: [{ menuItemId: 'm3', qty: 2 }, { menuItemId: 'm1', qty: 2 }],
    totalAmount: 122.00,
    paymentMethod: 'CARD'
  },
  {
    id: 's10',
    date: THREE_DAYS_AGO,
    time: '13:00',
    items: [{ menuItemId: 'm4', qty: 3 }, { menuItemId: 'm5', qty: 2 }],
    totalAmount: 90.00,
    paymentMethod: 'ONLINE'
  }
];
