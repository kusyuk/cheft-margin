import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, 
  Package, 
  UtensilsCrossed, 
  CalendarCheck, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCcw,
  PlusCircle,
  Save,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  X,
  Truck,
  Plus,
  User,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Menu,
  ChevronLeft,
  Receipt,
  CreditCard,
  Banknote,
  Calendar as CalendarIcon,
  Filter,
  ScanLine,
  Upload,
  Mail,
  Zap,
  Sparkles,
  History
} from 'lucide-react';

import { Ingredient, MenuItem, Reservation, AIAnalysisResponse, AlertType, Severity, RecipeItem, ReservationStatus, OrderItem, Sale, ParsedInvoice, QuickAction, AnalysisHistoryItem } from './types';
import { INITIAL_INGREDIENTS, INITIAL_MENU, INITIAL_RESERVATIONS, INITIAL_SALES } from './constants';
import { analyzeMargins, parseInvoiceImage } from './services/geminiService';

// Helper component for currency input to handle decimal focus/typing issues
const PriceInput = ({ value, onChange, placeholder, className }: { value: number, onChange: (val: number) => void, placeholder?: string, className?: string }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());

  useEffect(() => {
    const parsedLocal = parseFloat(localValue);
    if (parsedLocal !== value && !(Number.isNaN(parsedLocal) && value === 0)) {
       setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <div className="relative group w-full">
       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
       <input 
         type="number" 
         step="0.01"
         value={localValue}
         onChange={handleChange}
         onFocus={(e) => e.target.select()}
         className={`bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm transition-all placeholder:text-slate-300 w-full ${className}`}
         placeholder={placeholder}
       />
    </div>
  );
};

// Extracted NavContent to prevent re-creation on every render
const NavContent: React.FC<{
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'inventory' | 'menu' | 'reservations' | 'history') => void;
  triggerAIAnalysis: () => void;
  isAnalyzing: boolean;
}> = ({ activeTab, setActiveTab, triggerAIAnalysis, isAnalyzing }) => (
  <>
    <div className="p-6 border-b border-slate-100 flex items-center gap-3">
      <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-100">
        <TrendingUp className="text-white w-6 h-6" />
      </div>
      <span className="font-bold text-xl tracking-tight text-slate-900">Chef's Margin</span>
    </div>
    
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
      {[
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'inventory', icon: Package, label: 'Inventory & Market' },
        { id: 'menu', icon: UtensilsCrossed, label: 'Recipes & Menu' },
        { id: 'reservations', icon: CalendarCheck, label: 'Sales & Bookings' },
        { id: 'history', icon: History, label: 'Analysis History' }
      ].map(tab => (
        <button 
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
        >
          <tab.icon size={20} />
          {tab.label}
        </button>
      ))}
    </nav>

    <div className="p-4 border-t border-slate-100">
      <button 
        onClick={triggerAIAnalysis}
        disabled={isAnalyzing}
        className="w-full bg-slate-900 text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-md shadow-slate-200"
      >
        {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
        {isAnalyzing ? 'Analyzing...' : 'Run Margin AI'}
      </button>
    </div>
  </>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'menu' | 'reservations' | 'history'>('dashboard');
  
  // Persistence Helper
  const loadPersisted = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      console.warn(`Failed to load persisted ${key}:`, e);
      return fallback;
    }
  };

  // Data State - Initialize from Local Storage or fallback to Constants
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => loadPersisted('cm_ingredients', INITIAL_INGREDIENTS));
  const [menu, setMenu] = useState<MenuItem[]>(() => loadPersisted('cm_menu', INITIAL_MENU));
  const [reservations, setReservations] = useState<Reservation[]>(() => loadPersisted('cm_reservations', INITIAL_RESERVATIONS));
  const [sales, setSales] = useState<Sale[]>(() => loadPersisted('cm_sales', INITIAL_SALES));
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>(() => loadPersisted('cm_analysis_history', []));
  
  // UI State
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResponse | null>(() => loadPersisted('cm_analysis', null));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Persistence Effects - Save to Local Storage on change
  useEffect(() => { localStorage.setItem('cm_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('cm_menu', JSON.stringify(menu)); }, [menu]);
  useEffect(() => { localStorage.setItem('cm_reservations', JSON.stringify(reservations)); }, [reservations]);
  useEffect(() => { localStorage.setItem('cm_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('cm_analysis_history', JSON.stringify(analysisHistory)); }, [analysisHistory]);
  useEffect(() => { 
    if (analysisResult) localStorage.setItem('cm_analysis', JSON.stringify(analysisResult)); 
  }, [analysisResult]);

  // Check for first-time visitor
  useEffect(() => {
    try {
      const hasSeenWelcome = localStorage.getItem('chefs-margin-welcome-seen');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
      }
    } catch (e) {
      console.error("Local storage access failed", e);
    }
  }, []);

  const handleCloseWelcome = () => {
    try {
      localStorage.setItem('chefs-margin-welcome-seen', 'true');
    } catch (e) {
      console.error("Local storage save failed", e);
    }
    setShowWelcome(false);
  };
  
  // Date State - Safe local date construction
  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const today = getLocalToday();
  
  const getLocalLastWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const lastWeek = getLocalLastWeek();
  
  const [selectedDate, setSelectedDate] = useState<string>(today); 
  const [dashboardStartDate, setDashboardStartDate] = useState<string>(lastWeek); 
  const [dashboardEndDate, setDashboardEndDate] = useState<string>(today); 

  const [bookingViewMode, setBookingViewMode] = useState<'bookings' | 'sales'>('bookings');

  // Modal States
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [scannedInvoice, setScannedInvoice] = useState<ParsedInvoice | null>(null);

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<MenuItem | null>(null);
  const [draftRecipeIngredients, setDraftRecipeIngredients] = useState<RecipeItem[]>([]);

  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [draftReservationOrders, setDraftReservationOrders] = useState<OrderItem[]>([]);

  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [draftSalesItems, setDraftSalesItems] = useState<OrderItem[]>([]);

  // Filtered Data
  const filteredSales = useMemo(() => {
    return sales.filter(s => s.date >= dashboardStartDate && s.date <= dashboardEndDate);
  }, [sales, dashboardStartDate, dashboardEndDate]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(r => r.date >= dashboardStartDate && r.date <= dashboardEndDate);
  }, [reservations, dashboardStartDate, dashboardEndDate]);

  // Dashboard Calculations
  const dashboardStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    
    // 1. Calculate Revenue/Cost from Sales (Daily Sales)
    filteredSales.forEach(sale => {
       totalRevenue += sale.totalAmount;
       sale.items.forEach(item => {
           const menuItem = menu.find(m => m.id === item.menuItemId);
           if (menuItem) {
               const itemCost = menuItem.ingredients.reduce((acc, ri) => {
                   const ing = ingredients.find(i => i.id === ri.ingredientId);
                   return acc + (ing ? ing.currentMarketPrice * ri.qty : 0);
               }, 0);
               totalCost += itemCost * item.qty;
           }
       });
    });

    const avgTicketPrice = menu.length > 0 ? menu.reduce((acc, m) => acc + m.sellingPrice, 0) / menu.length : 30;

    // 2. Calculate Revenue/Cost from Reservations (Expanded Statuses)
    // Include SEATED and COMPLETED for historical accuracy in the selected period
    const validStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.SEATED, ReservationStatus.COMPLETED];

    filteredReservations.forEach(res => {
      if (validStatuses.includes(res.status)) {
          if (res.orders.length > 0) {
            res.orders.forEach(order => {
              const menuItem = menu.find(m => m.id === order.menuItemId);
              if (menuItem) {
                totalRevenue += menuItem.sellingPrice * order.qty;
                const cost = menuItem.ingredients.reduce((acc, ri) => {
                    const ing = ingredients.find(i => i.id === ri.ingredientId);
                    return acc + (ing ? ing.currentMarketPrice * ri.qty : 0);
                }, 0);
                totalCost += cost * order.qty;
              }
            });
          } else {
            // Estimation for bookings without pre-orders
            totalRevenue += res.pax * avgTicketPrice;
            totalCost += res.pax * avgTicketPrice * 0.3;
          }
      }
    });

    // 3. Aggregate Item Demand (Quantity Sold in Period)
    const itemDemand: Record<string, number> = {};
    
    filteredSales.forEach(s => s.items.forEach(i => {
       itemDemand[i.menuItemId] = (itemDemand[i.menuItemId] || 0) + i.qty;
    }));
    
    filteredReservations.forEach(r => {
        if (validStatuses.includes(r.status)) {
            r.orders?.forEach(i => {
                itemDemand[i.menuItemId] = (itemDemand[i.menuItemId] || 0) + i.qty;
            });
        }
    });

    // 4. Calculate Chart Data (Total Period Performance)
    const chartData = menu.map(item => {
      const unitCost = item.ingredients.reduce((acc, recipeItem) => {
        const ing = ingredients.find(i => i.id === recipeItem.ingredientId);
        return acc + (ing ? ing.currentMarketPrice * recipeItem.qty : 0);
      }, 0);
      
      const unitMargin = item.sellingPrice - unitCost;
      const marginPercent = (unitMargin / (item.sellingPrice || 1)) * 100;
      const qtySold = itemDemand[item.id] || 0;
      
      // Calculate Total Cost & Profit for the period based on volume
      const totalPeriodCost = unitCost * qtySold;
      const totalPeriodProfit = unitMargin * qtySold;

      return {
        name: item.name,
        // Chart uses these keys
        cost: Number(totalPeriodCost.toFixed(2)),
        margin: Number(totalPeriodProfit.toFixed(2)),
        // Metadata
        price: item.sellingPrice,
        marginPercent: Number(marginPercent.toFixed(1)),
        qty: qtySold,
        unitCost: Number(unitCost.toFixed(2)),
        unitMargin: Number(unitMargin.toFixed(2))
      };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      chartData
    };
  }, [ingredients, menu, filteredReservations, filteredSales]);

  // Handlers
  const handleUpdateMarketPrice = (id: string, newPrice: number) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, currentMarketPrice: newPrice } : i));
  };

  const handleScanClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanningInvoice(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        const result = await parseInvoiceImage(base64Data);
        setScannedInvoice(result);
        setIsScanningInvoice(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Scanning failed", error);
      setIsScanningInvoice(false);
      alert("Failed to scan invoice.");
    }
    event.target.value = '';
  };

  const handleConfirmInvoice = () => {
    if (!scannedInvoice) return;
    const updatedIngredients = [...ingredients];
    scannedInvoice.items.forEach(item => {
      const existingIndex = updatedIngredients.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (existingIndex > -1) {
        updatedIngredients[existingIndex] = {
          ...updatedIngredients[existingIndex],
          currentStock: updatedIngredients[existingIndex].currentStock + item.qty,
          currentMarketPrice: item.unitPrice,
          supplierName: scannedInvoice.supplierName || updatedIngredients[existingIndex].supplierName
        };
      } else {
        updatedIngredients.push({
          id: `i-scan-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: item.name,
          unit: item.unit,
          currentStock: item.qty,
          currentMarketPrice: item.unitPrice,
          basePrice: item.unitPrice,
          supplierName: scannedInvoice.supplierName,
          supplierContact: ''
        });
      }
    });
    setIngredients(updatedIngredients);
    setScannedInvoice(null);
  };

  const handleRemoveScannedItem = (index: number) => {
    if (!scannedInvoice) return;
    const newItems = [...scannedInvoice.items];
    newItems.splice(index, 1);
    setScannedInvoice({ ...scannedInvoice, items: newItems });
  };

  const handleExecuteAction = (action: QuickAction) => {
    if (action.type === 'SUPPLIER_EMAIL' && action.email_recipient) {
      const subject = encodeURIComponent(action.email_subject || 'Order Request');
      const body = encodeURIComponent(action.email_body || '');
      window.location.href = `mailto:${action.email_recipient}?subject=${subject}&body=${body}`;
    } else if (action.type === 'PRICE_UPDATE' && action.menu_item_name && action.suggested_price) {
      if (confirm(`Update price of ${action.menu_item_name} to $${action.suggested_price}?`)) {
        setMenu(prev => prev.map(m => {
          if (m.name.toLowerCase() === action.menu_item_name?.toLowerCase()) {
            return { ...m, sellingPrice: action.suggested_price! };
          }
          return m;
        }));
        if (analysisResult) {
           const newActions = analysisResult.quick_actions.filter(a => a !== action);
           setAnalysisResult({ ...analysisResult, quick_actions: newActions });
        }
      }
    }
  };

  const handleSaveIngredient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ingredientData: Ingredient = {
      id: editingIngredient?.id || `i${Date.now()}`,
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      basePrice: parseFloat(formData.get('basePrice') as string),
      currentMarketPrice: editingIngredient ? editingIngredient.currentMarketPrice : parseFloat(formData.get('basePrice') as string),
      currentStock: parseFloat(formData.get('currentStock') as string),
      supplierName: formData.get('supplierName') as string,
      supplierContact: formData.get('supplierContact') as string
    };

    if (editingIngredient) {
      setIngredients(prev => prev.map(i => i.id === editingIngredient.id ? { ...ingredientData, currentMarketPrice: editingIngredient.currentMarketPrice } : i));
    } else {
      setIngredients(prev => [...prev, ingredientData]);
    }
    setIsIngredientModalOpen(false);
    setEditingIngredient(null);
  };

  const handleDeleteIngredient = (id: string) => {
    if (confirm('Are you sure?')) setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const openRecipeModal = (recipe?: MenuItem) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setDraftRecipeIngredients([...recipe.ingredients]);
    } else {
      setEditingRecipe(null);
      setDraftRecipeIngredients([]);
    }
    setIsRecipeModalOpen(true);
  };

  const handleAddRecipeIngredientRow = () => setDraftRecipeIngredients(prev => [...prev, { ingredientId: '', qty: 0 }]);
  
  const handleUpdateRecipeIngredientRow = (index: number, field: keyof RecipeItem, value: any) => {
    setDraftRecipeIngredients(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const handleRemoveRecipeIngredientRow = (index: number) => setDraftRecipeIngredients(prev => prev.filter((_, i) => i !== index));

  const handleSaveRecipe = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validIngredients = draftRecipeIngredients.filter(ri => ri.ingredientId && ri.qty > 0);
    const recipeData: MenuItem = {
      id: editingRecipe?.id || `m${Date.now()}`,
      name: formData.get('name') as string,
      sellingPrice: parseFloat(formData.get('sellingPrice') as string),
      ingredients: validIngredients
    };

    if (editingRecipe) {
      setMenu(prev => prev.map(m => m.id === editingRecipe.id ? recipeData : m));
    } else {
      setMenu(prev => [...prev, recipeData]);
    }
    setIsRecipeModalOpen(false);
    setEditingRecipe(null);
  };

  const handleDeleteRecipe = (id: string) => {
    if (confirm('Delete this recipe?')) setMenu(prev => prev.filter(m => m.id !== id));
  };

  const openReservationModal = (res?: Reservation) => {
    if (res) {
      setEditingReservation(res);
      setDraftReservationOrders(res.orders ? [...res.orders] : []);
    } else {
      setEditingReservation(null);
      setDraftReservationOrders([]);
    }
    setIsReservationModalOpen(true);
  };

  const handleAddOrderRow = () => setDraftReservationOrders(prev => [...prev, { menuItemId: '', qty: 1 }]);
  
  const handleUpdateOrderRow = (index: number, field: keyof OrderItem, value: any) => {
    setDraftReservationOrders(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const handleRemoveOrderRow = (index: number) => setDraftReservationOrders(prev => prev.filter((_, i) => i !== index));

  const handleSaveReservation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validOrders = draftReservationOrders.filter(o => o.menuItemId && o.qty > 0);
    
    const resData: Reservation = {
      id: editingReservation?.id || `r${Date.now()}`,
      customerName: formData.get('customerName') as string,
      pax: parseInt(formData.get('pax') as string),
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      status: formData.get('status') as ReservationStatus,
      notes: formData.get('notes') as string,
      orders: validOrders
    };

    if (editingReservation) {
      setReservations(prev => prev.map(r => r.id === editingReservation.id ? resData : r));
    } else {
      setReservations(prev => [...prev, resData]);
    }
    setIsReservationModalOpen(false);
    setEditingReservation(null);
  };

  const handleDeleteReservation = (id: string) => {
     if (confirm('Cancel booking?')) setReservations(prev => prev.filter(r => r.id !== id));
  };

  const openSalesModal = () => {
    setDraftSalesItems([{ menuItemId: '', qty: 1 }]);
    setIsSalesModalOpen(true);
  };

  const handleAddSaleItemRow = () => setDraftSalesItems(prev => [...prev, { menuItemId: '', qty: 1 }]);

  const handleUpdateSaleItemRow = (index: number, field: keyof OrderItem, value: any) => {
    setDraftSalesItems(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const handleRemoveSaleItemRow = (index: number) => setDraftSalesItems(prev => prev.filter((_, i) => i !== index));

  const handleSaveSale = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validItems = draftSalesItems.filter(i => i.menuItemId && i.qty > 0);
    const totalAmount = validItems.reduce((sum, item) => {
        const m = menu.find(x => x.id === item.menuItemId);
        return sum + (m ? m.sellingPrice * item.qty : 0);
    }, 0);

    const saleData: Sale = {
        id: `s${Date.now()}`,
        date: selectedDate,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        items: validItems,
        totalAmount: totalAmount,
        paymentMethod: formData.get('paymentMethod') as 'CASH' | 'CARD'
    };
    setSales(prev => [...prev, saleData]);
    setIsSalesModalOpen(false);
  };

  const handleDeleteHistory = (id: string) => {
    if(confirm('Delete this analysis record?')) {
      setAnalysisHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const triggerAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeMargins(
        ingredients, menu, filteredReservations, filteredSales,
        { start: dashboardStartDate, end: dashboardEndDate }
      );
      setAnalysisResult(result);
      
      // Save to history
      const historyItem: AnalysisHistoryItem = {
        id: `analysis-${Date.now()}`,
        timestamp: new Date().toISOString(),
        dateRange: { start: dashboardStartDate, end: dashboardEndDate },
        result: result
      };
      setAnalysisHistory(prev => [historyItem, ...prev]);

    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Calendar Logic - Robust version
  const getDaysInMonth = (dateString: string) => {
     try {
       const date = new Date(dateString);
       if (isNaN(date.getTime())) throw new Error("Invalid date");
       const year = date.getUTCFullYear();
       const month = date.getUTCMonth();
       // Get last day of month correctly
       const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
       const days = [];
       for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(Date.UTC(year, month, i));
          days.push(d.toISOString().split('T')[0]);
       }
       return days;
     } catch (e) {
       console.error("Date error", e);
       return [];
     }
  };
  
  const currentMonthDays = useMemo(() => getDaysInMonth(selectedDate), [selectedDate]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
        <NavContent 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          triggerAIAnalysis={triggerAIAnalysis} 
          isAnalyzing={isAnalyzing} 
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] relative">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-1.5 rounded-lg shadow-sm">
                 <TrendingUp className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-slate-900">Chef's Margin</span>
            </div>
            <button onClick={triggerAIAnalysis} disabled={isAnalyzing} className="bg-slate-900 text-white p-2 rounded-lg flex items-center gap-2 text-xs font-bold shadow-md shadow-slate-200 disabled:opacity-50 active:scale-95 transition-transform">
               {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
               {isAnalyzing ? '...' : 'AI Scan'}
            </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Operations Overview</h1>
                  <p className="text-slate-500 mt-1">Financial performance for selected period</p>
                </div>
                <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 flex-wrap">
                   <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Filter size={14} /> Period
                   </div>
                   <input type="date" value={dashboardStartDate} onChange={(e) => setDashboardStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" />
                   <span className="text-slate-400 font-medium">to</span>
                   <input type="date" value={dashboardEndDate} onChange={(e) => setDashboardEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </header>
              
              {analysisResult && (
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-200/50 flex flex-col lg:flex-row items-start gap-4">
                  <div className="bg-white/20 p-2 rounded-lg shrink-0">
                      <TrendingUp className="text-white" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-lg">AI Financial Insight ({analysisResult.analysis_summary.split(' ').slice(0, 5).join(' ')}...)</h3>
                      <p className="text-indigo-50 mt-1">{analysisResult.analysis_summary}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <p className="text-slate-500 font-medium">Total Period Revenue</p>
                  <p className="text-3xl font-bold">${dashboardStats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold mt-2">
                    <TrendingUp size={14} /> <span>Sales + Bookings</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <p className="text-slate-500 font-medium">Period Food Cost</p>
                  <p className="text-3xl font-bold text-red-500">${dashboardStats.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-slate-400 text-sm mt-2">Based on current market rates</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <p className="text-slate-500 font-medium">Net Margin</p>
                  <p className="text-3xl font-bold text-indigo-600">{dashboardStats.marginPercent.toFixed(1)}%</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${dashboardStats.marginPercent < 20 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, dashboardStats.marginPercent)}%` }} />
                  </div>
                </div>
              </div>

              {analysisResult?.quick_actions && analysisResult.quick_actions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="text-amber-500 fill-amber-500" /> Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysisResult.quick_actions.map((action, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                         <div className="flex items-start gap-3 mb-3">
                           <div className={`p-2 rounded-xl shrink-0 ${action.type === 'SUPPLIER_EMAIL' ? 'bg-sky-100 text-sky-600' : 'bg-emerald-100 text-emerald-600'}`}>
                             {action.type === 'SUPPLIER_EMAIL' ? <Mail size={20} /> : <TrendingUp size={20} />}
                           </div>
                           <div>
                             <h4 className="font-bold text-slate-800">{action.title}</h4>
                             <p className="text-xs text-slate-500 mt-1 leading-relaxed">{action.reason}</p>
                           </div>
                         </div>
                         <div className="mt-auto pt-3 border-t border-slate-50">
                               <button onClick={() => handleExecuteAction(action)} className={`w-full py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${action.type === 'SUPPLIER_EMAIL' ? 'bg-sky-50 text-sky-700 hover:bg-sky-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                  {action.type === 'SUPPLIER_EMAIL' ? <><Mail size={16} /> Draft Email</> : <><RefreshCcw size={16} /> Update Price</>}
                               </button>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg mb-6">Menu Performance (Top 5 Active)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardStats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} interval={0} tickFormatter={(value) => value.length > 8 ? `${value.slice(0, 8)}..` : value} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="cost" fill="#f87171" radius={[4, 4, 0, 0]} name="Period Cost" />
                        <Bar dataKey="margin" fill="#10b981" radius={[4, 4, 0, 0]} name="Period Profit ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg">AI Alerts</h3>
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        {analysisResult?.alerts.length || 0} Active
                    </span>
                  </div>
                  <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                    {!analysisResult && (
                      <div className="text-center py-12 text-slate-400">
                        <AlertTriangle className="mx-auto mb-2 opacity-20" size={48} />
                        <p>System Idle - Run Analysis</p>
                      </div>
                    )}
                    {analysisResult?.alerts.map((alert, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 ${alert.severity === Severity.HIGH ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className={`p-2 rounded-lg shrink-0 ${alert.severity === Severity.HIGH ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                          {alert.type === AlertType.STOCKOUT ? <Package size={18} /> : <UtensilsCrossed size={18} />}
                        </div>
                        <div className="flex-1">
                          <span className={`text-xs font-bold uppercase tracking-wider ${alert.severity === Severity.HIGH ? 'text-red-600' : 'text-amber-600'}`}>{alert.type}</span>
                          <h4 className="font-bold mt-0.5 text-slate-800">{alert.item_name}</h4>
                          <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                          <div className="mt-2 text-xs font-bold text-slate-500 uppercase">Action: {alert.suggested_action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-8">
               <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Inventory Management</h1>
                  </div>
                  <div className="flex w-full lg:w-auto gap-3">
                     <button onClick={handleScanClick} disabled={isScanningInvoice} className="flex-1 lg:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-bold shadow-sm">
                       {isScanningInvoice ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
                       {isScanningInvoice ? 'Scanning...' : 'Scan Invoice'}
                     </button>
                     <button onClick={() => { setEditingIngredient(null); setIsIngredientModalOpen(true); }} className="flex-1 lg:flex-none bg-emerald-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-semibold shadow-lg shadow-emerald-100">
                        <PlusCircle size={18} /> Add Item
                     </button>
                  </div>
              </header>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-8 py-4">Ingredient</th>
                          <th className="px-8 py-4">Stock</th>
                          <th className="px-8 py-4">Supplier</th>
                          <th className="px-8 py-4">Trend</th>
                          <th className="px-8 py-4 text-left">Market Price</th>
                          <th className="px-8 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ingredients.map(ing => {
                          const variance = ((ing.currentMarketPrice - ing.basePrice) / (ing.basePrice || 1)) * 100;
                          return (
                            <tr key={ing.id} className="group hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                      <Package size={20} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-800">{ing.name}</p>
                                      <p className="text-xs text-slate-400">${ing.basePrice.toFixed(2)} Base</p>
                                    </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <span className="font-bold text-slate-700">{ing.currentStock}</span> <span className="text-slate-400 text-xs uppercase">{ing.unit}</span>
                              </td>
                              <td className="px-8 py-6">
                                    <span className="text-sm font-semibold text-slate-700 block">{ing.supplierName || '-'}</span>
                                    <span className="text-xs text-slate-400">{ing.supplierContact}</span>
                              </td>
                              <td className="px-8 py-6">
                                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs ${variance > 0 ? 'bg-red-50 text-red-600' : variance < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                  {variance > 0 ? <ArrowUpRight size={14} /> : variance < 0 ? <ArrowDownRight size={14} /> : null}
                                  {variance === 0 ? 'STABLE' : `${Math.abs(variance).toFixed(1)}%`}
                                </div>
                              </td>
                              <td className="px-8 py-6 text-left">
                                <div className="w-32">
                                  <PriceInput value={ing.currentMarketPrice} onChange={(val) => handleUpdateMarketPrice(ing.id, val)} placeholder="0.00" />
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingIngredient(ing); setIsIngredientModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteIngredient(ing.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
             <div className="space-y-8">
               <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Menu Engineering</h1>
                  </div>
                  <button onClick={() => openRecipeModal()} className="w-full lg:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-semibold shadow-lg shadow-emerald-100">
                    <PlusCircle size={18} /> New Recipe
                  </button>
              </header>

              <div className="grid grid-cols-1 gap-6">
                  {menu.map(item => {
                    const itemCost = item.ingredients.reduce((acc, ri) => {
                      const ing = ingredients.find(i => i.id === ri.ingredientId);
                      return acc + (ing ? ing.currentMarketPrice * ri.qty : 0);
                    }, 0);
                    const margin = item.sellingPrice - itemCost;
                    const marginPercent = (margin / (item.sellingPrice || 1)) * 100;

                    return (
                      <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 group hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row justify-between gap-8">
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                  {item.name}
                                  {marginPercent < 20 && <AlertTriangle className="text-red-500" size={24} />}
                              </h3>
                              <div className="mt-6 space-y-3">
                                  {item.ingredients.map((ri, idx) => {
                                    const ing = ingredients.find(i => i.id === ri.ingredientId);
                                    return (
                                      <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                        <span className="text-slate-700 font-medium">{ing?.name} <span className="text-slate-400 text-xs">({ri.qty} {ing?.unit})</span></span>
                                        <span className="font-semibold text-slate-900">${((ing?.currentMarketPrice || 0) * ri.qty).toFixed(2)}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                            <div className="lg:w-72 bg-slate-50 rounded-2xl p-6 flex flex-col justify-between border border-slate-100">
                              <div>
                                  <div className="flex justify-between items-center text-sm text-slate-500 mb-1">
                                    <span>Price</span> <span className="font-bold text-slate-900">${item.sellingPrice.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm text-slate-500">
                                    <span>Cost</span> <span className="font-bold text-slate-900">${itemCost.toFixed(2)}</span>
                                  </div>
                                  <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-end">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Margin</span>
                                    <div className={`text-2xl font-black ${marginPercent < 20 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {marginPercent.toFixed(0)}%
                                    </div>
                                  </div>
                              </div>
                              <button onClick={() => openRecipeModal(item)} className="mt-6 w-full bg-white border border-slate-200 py-2.5 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">
                                  Edit Recipe
                              </button>
                            </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'reservations' && (
            <div className="space-y-6 pb-20">
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 shrink-0">
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Sales & Bookings</h1>
                    <p className="text-slate-500 mt-1">Track daily transactions and future reservations.</p>
                  </div>
              </header>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm shrink-0 overflow-x-auto">
                 <div className="flex items-center gap-2 min-w-max">
                    {currentMonthDays.map(date => {
                        const d = new Date(date);
                        const isSelected = date === selectedDate;
                        // Use explicit UTC to avoid offset issues since date string is YYYY-MM-DD
                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                        const dayNum = d.getUTCDate();
                        const hasBooking = reservations.some(r => r.date === date);
                        const hasSale = sales.some(s => s.date === date);

                        return (
                            <button 
                                key={date} 
                                onClick={() => setSelectedDate(date)}
                                className={`flex flex-col items-center justify-center w-14 h-20 rounded-xl transition-all border-2 relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'}`}
                            >
                                <span className="text-xs font-medium uppercase">{dayName}</span>
                                <span className={`text-xl font-bold mt-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{dayNum}</span>
                                <div className="flex gap-1 mt-2">
                                    {hasBooking && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500'}`} />}
                                    {hasSale && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-400' : 'bg-sky-500'}`} />}
                                </div>
                            </button>
                        );
                    })}
                 </div>
              </div>

              <div className="flex items-center bg-slate-200/50 p-1 rounded-xl self-start shrink-0">
                 <button onClick={() => setBookingViewMode('bookings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${bookingViewMode === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Reservations
                 </button>
                 <button onClick={() => setBookingViewMode('sales')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${bookingViewMode === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    Daily Sales
                 </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 lg:p-6 min-h-[500px]">
                 {bookingViewMode === 'bookings' && (
                     <div className="space-y-3">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Bookings for {selectedDate}</h3>
                            <button onClick={() => openReservationModal()} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <PlusCircle size={14} /> New Booking
                            </button>
                         </div>
                         
                         {reservations.filter(r => r.date === selectedDate).length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <CalendarCheck className="mx-auto mb-2 opacity-20" size={48} />
                                <p>No reservations for this date.</p>
                            </div>
                         )}

                         {reservations.filter(r => r.date === selectedDate).map(res => {
                             let orderTotal = 0;
                             if (res.orders) {
                                res.orders.forEach(o => {
                                  const m = menu.find(i => i.id === o.menuItemId);
                                  if (m) orderTotal += m.sellingPrice * o.qty;
                                });
                             }
                             return (
                                <div key={res.id} onClick={() => openReservationModal(res)} className="p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group gap-4">
                                    <div className="flex items-start md:items-center gap-4 w-full md:w-auto">
                                       <div className="bg-slate-100 text-slate-600 font-bold px-3 py-2 rounded-lg text-sm">{res.time}</div>
                                       <div className="flex-1">
                                           <div className="flex items-center gap-2">
                                              <p className="font-bold text-slate-900">{res.customerName}</p>
                                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${res.status === ReservationStatus.CONFIRMED ? 'bg-sky-50 text-sky-600 border-sky-100' : res.status === ReservationStatus.SEATED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{res.status}</span>
                                           </div>
                                           <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                                              <User size={12} /> {res.pax} Guests 
                                              {orderTotal > 0 && <span className="font-bold text-emerald-600">• ${orderTotal.toFixed(2)} Pre-order</span>}
                                           </p>
                                       </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </div>
                             );
                         })}
                     </div>
                 )}

                 {bookingViewMode === 'sales' && (
                     <div className="space-y-3">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Transactions for {selectedDate}</h3>
                            <button onClick={openSalesModal} className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100">
                                <Receipt size={14} /> Record Sale
                            </button>
                         </div>

                         {sales.filter(s => s.date === selectedDate).length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <Banknote className="mx-auto mb-2 opacity-20" size={48} />
                                <p>No sales recorded for this date.</p>
                            </div>
                         )}

                         {sales.filter(s => s.date === selectedDate).map(sale => (
                             <div key={sale.id} className="p-4 rounded-2xl border border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                 <div className="flex items-center gap-4">
                                     <div className="bg-sky-100 text-sky-700 p-2 rounded-xl">
                                         <Receipt size={20} />
                                     </div>
                                     <div>
                                         <p className="font-bold text-slate-900 text-lg">${sale.totalAmount.toFixed(2)}</p>
                                         <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                             <Clock size={12} /> {sale.time}
                                             <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                             <span className="uppercase font-bold">{sale.paymentMethod}</span>
                                             <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                             <span>{sale.items.reduce((sum, i) => sum + i.qty, 0)} Items</span>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="text-right text-xs text-slate-400">
                                     {sale.items.slice(0, 2).map((item, idx) => {
                                         const m = menu.find(x => x.id === item.menuItemId);
                                         return <div key={idx}>{item.qty}x {m?.name}</div>;
                                     })}
                                     {sale.items.length > 2 && <div>+{sale.items.length - 2} more</div>}
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <header>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Analysis History</h1>
                <p className="text-slate-500 mt-1">Archive of past AI margin reports</p>
              </header>

              <div className="space-y-4">
                {analysisHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-200">
                     <History className="mx-auto mb-2 opacity-20" size={48} />
                     <p>No analysis history found.</p>
                  </div>
                )}
                {analysisHistory.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                           <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                              <CalendarIcon size={14} />
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                Period: {item.dateRange.start} to {item.dateRange.end}
                              </span>
                           </div>
                           <h3 className="font-bold text-lg text-slate-900">Analysis Report</h3>
                        </div>
                        <button onClick={() => handleDeleteHistory(item.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                     </div>
                     
                     <div className="bg-indigo-50 p-4 rounded-xl text-indigo-900 text-sm mb-4 border border-indigo-100/50">
                        {item.result.analysis_summary}
                     </div>

                     <div className="flex gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                           <AlertTriangle size={16} className={item.result.alerts.length > 0 ? "text-amber-500" : "text-slate-400"} />
                           {item.result.alerts.length} Alerts
                        </div>
                         <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                           <Zap size={16} className={item.result.quick_actions.length > 0 ? "text-amber-500" : "text-slate-400"} />
                           {item.result.quick_actions.length} Actions
                        </div>
                     </div>

                     {item.result.alerts.length > 0 && (
                       <div className="space-y-2 mt-4 border-t border-slate-100 pt-4">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Flagged Items</h4>
                         {item.result.alerts.map((alert, idx) => (
                           <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="font-bold text-slate-700">{alert.item_name}</span>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${alert.severity === Severity.HIGH ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{alert.type}</span>
                           </div>
                         ))}
                       </div>
                     )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
        
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center p-2 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
            { id: 'inventory', icon: Package, label: 'Stock' },
            { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
            { id: 'reservations', icon: CalendarCheck, label: 'Bookings' }
          ].map(tab => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-full ${activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600 active:bg-slate-50'}`}
            >
               <tab.icon size={24} className={activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-2'} />
               <span className="text-[10px] font-bold mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Modals are now at the root level to ensure correct stacking context */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <TrendingUp size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Chef's Margin</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">Your AI-powered assistant for protecting restaurant profits and automating inventory.</p>

                    <div className="space-y-4 text-left">
                        <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="bg-white p-2.5 rounded-lg shadow-sm text-indigo-600 h-fit border border-indigo-50"><ScanLine size={20}/></div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm">AI Invoice Scanning</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-normal">Snap a photo of invoices to auto-update stock & prices instantly.</p>
                            </div>
                        </div>
                         <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="bg-white p-2.5 rounded-lg shadow-sm text-amber-500 h-fit border border-amber-50"><Sparkles size={20}/></div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm">Margin Defender</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-normal">Real-time alerts when ingredient costs spike and eat into your profits.</p>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleCloseWelcome} className="mt-8 w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">
                        Get Started
                    </button>
                </div>
            </div>
        </div>
      )}

      {scannedInvoice && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <ScanLine className="text-emerald-600" />
                        Review Invoice
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">Scanned from <strong>{scannedInvoice.supplierName}</strong></p>
                </div>
                <button onClick={() => setScannedInvoice(null)} className="text-slate-400 hover:text-slate-600 p-1">
                   <X size={24} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    Please review the items extracted by AI. Confirming will update existing inventory stock and prices, or create new items.
                </p>
                
                <div className="space-y-3">
                    {scannedInvoice.items.map((item, idx) => {
                         const match = ingredients.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                         return (
                            <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border ${match ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-200'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${match ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {match ? <RefreshCcw size={14} /> : <Plus size={14} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900">{item.name}</h4>
                                        {match && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Merge</span>}
                                        {!match && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">New</span>}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                        <span>Qty: <strong>{item.qty} {item.unit}</strong></span>
                                        <span>Price: <strong>${item.unitPrice.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                                <button onClick={() => handleRemoveScannedItem(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                         );
                    })}
                </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3 justify-end">
                <button onClick={() => setScannedInvoice(null)} className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Discard</button>
                <button onClick={handleConfirmInvoice} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">
                    Confirm & Update Inventory
                </button>
             </div>
           </div>
         </div>
      )}

      {isIngredientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">{editingIngredient ? 'Edit Ingredient' : 'New Ingredient'}</h2>
              <button onClick={() => setIsIngredientModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveIngredient} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ingredient Name</label>
                  <input name="name" defaultValue={editingIngredient?.name} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Italian Truffle Oil" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Unit</label>
                  <input name="unit" defaultValue={editingIngredient?.unit} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="kg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Base Price ($)</label>
                  <input name="basePrice" type="number" step="0.01" defaultValue={editingIngredient?.basePrice} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stock</label>
                  <input name="currentStock" type="number" step="0.1" defaultValue={editingIngredient?.currentStock} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.0" />
                </div>
              </div>
              <div className="pt-2">
                <div className="bg-indigo-50/50 p-4 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <Truck size={14} /> Supplier Information
                  </h4>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Name</label>
                    <input name="supplierName" defaultValue={editingIngredient?.supplierName} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Fresh Direct Ltd." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Details</label>
                    <input name="supplierContact" defaultValue={editingIngredient?.supplierContact} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Email or Phone" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsIngredientModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">Save Ingredient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-900">{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
              <button onClick={() => setIsRecipeModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveRecipe} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dish Name</label>
                    <input name="name" defaultValue={editingRecipe?.name} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Price ($)</label>
                    <input name="sellingPrice" type="number" step="0.01" defaultValue={editingRecipe?.sellingPrice} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingredients</label>
                    <button type="button" onClick={handleAddRecipeIngredientRow} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        <PlusCircle size={14} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {draftRecipeIngredients.map((row, idx) => {
                      const selectedIng = ingredients.find(i => i.id === row.ingredientId);
                      return (
                        <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                            <div className="flex-1">
                              <select 
                                value={row.ingredientId} 
                                onChange={(e) => handleUpdateRecipeIngredientRow(idx, 'ingredientId', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                              >
                                <option value="" disabled>Select Ingredient...</option>
                                {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                              </select>
                            </div>
                            <div className="w-24 relative">
                              <input type="number" step="0.001" value={row.qty || ''} onChange={(e) => handleUpdateRecipeIngredientRow(idx, 'qty', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none" placeholder="Qty" required />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{selectedIng?.unit || '-'}</span>
                            </div>
                            <button type="button" onClick={() => handleRemoveRecipeIngredientRow(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3">
                {editingRecipe && <button type="button" onClick={() => { setIsRecipeModalOpen(false); handleDeleteRecipe(editingRecipe.id); }} className="px-4 py-3 border border-red-100 text-red-600 bg-red-50 rounded-xl font-bold hover:bg-red-100">Delete</button>}
                <div className="flex-1 flex gap-3 justify-end">
                    <button type="button" onClick={() => setIsRecipeModalOpen(false)} className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReservationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-900">{editingReservation ? 'Manage Reservation' : 'New Reservation'}</h2>
              <button onClick={() => setIsReservationModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveReservation} className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              <div className="p-6 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Guest Details</h3>
                <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Customer Name</label>
                      <input name="customerName" defaultValue={editingReservation?.customerName} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. John Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Date</label>
                          <input type="date" name="date" defaultValue={editingReservation?.date} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Time</label>
                          <input type="time" name="time" defaultValue={editingReservation?.time} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Pax</label>
                        <input type="number" name="pax" defaultValue={editingReservation?.pax || 2} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Status</label>
                        <select name="status" defaultValue={editingReservation?.status || ReservationStatus.CONFIRMED} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                          {Object.values(ReservationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Notes</label>
                      <textarea name="notes" defaultValue={editingReservation?.notes} rows={3} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="Allergies, special occasions..." />
                    </div>
                </div>
              </div>

              <div className="p-6 lg:w-2/3 flex flex-col bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Management</h3>
                    <button type="button" onClick={handleAddOrderRow} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <PlusCircle size={14} /> Add Menu Item
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {draftReservationOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl p-8">
                          <UtensilsCrossed size={32} className="mb-2 opacity-50" />
                          <p className="text-sm font-medium">No items ordered yet.</p>
                        </div>
                    )}
                    {draftReservationOrders.map((row, idx) => {
                        const menuItem = menu.find(m => m.id === row.menuItemId);
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex-1">
                                <select 
                                  value={row.menuItemId} 
                                  onChange={(e) => handleUpdateOrderRow(idx, 'menuItemId', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  required
                                >
                                  <option value="" disabled>Select Item...</option>
                                  {menu.map(m => <option key={m.id} value={m.id}>{m.name} - ${m.sellingPrice.toFixed(2)}</option>)}
                                </select>
                              </div>
                              <div className="w-20">
                                <input 
                                  type="number" 
                                  min="1"
                                  value={row.qty} 
                                  onChange={(e) => handleUpdateOrderRow(idx, 'qty', parseInt(e.target.value) || 0)} 
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none text-center"
                                />
                              </div>
                              <div className="w-24 text-right font-bold text-slate-700">
                                ${menuItem ? (menuItem.sellingPrice * row.qty).toFixed(2) : '0.00'}
                              </div>
                              <button type="button" onClick={() => handleRemoveOrderRow(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={16} />
                              </button>
                          </div>
                        );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                        {draftReservationOrders.length} items
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Bill</p>
                        <p className="text-2xl font-black text-slate-900">
                          ${draftReservationOrders.reduce((acc, row) => {
                              const m = menu.find(i => i.id === row.menuItemId);
                              return acc + (m ? m.sellingPrice * row.qty : 0);
                          }, 0).toFixed(2)}
                        </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 mt-2">
                    {editingReservation && <button type="button" onClick={() => { setIsReservationModalOpen(false); handleDeleteReservation(editingReservation.id); }} className="px-4 py-3 border border-red-100 text-red-600 bg-red-50 rounded-xl font-bold hover:bg-red-100">Cancel Booking</button>}
                    <div className="flex-1 flex gap-3 justify-end">
                        <button type="button" onClick={() => setIsReservationModalOpen(false)} className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Discard</button>
                        <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">
                          {editingReservation ? 'Update Booking' : 'Confirm Booking'}
                        </button>
                    </div>
                  </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSalesModalOpen && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-900">Record Sale</h2>
              <button onClick={() => setIsSalesModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveSale} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                            <input disabled value={selectedDate} className="w-full bg-slate-200 border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 font-bold" />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                            <select name="paymentMethod" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 font-medium">
                                <option value="CARD">Card</option>
                                <option value="CASH">Cash</option>
                                <option value="ONLINE">Online</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items Sold</h3>
                       <button type="button" onClick={handleAddSaleItemRow} className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                            <PlusCircle size={14} /> Add Item
                       </button>
                    </div>
                    
                    {draftSalesItems.map((row, idx) => {
                        const menuItem = menu.find(m => m.id === row.menuItemId);
                        return (
                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex-1">
                                  <select 
                                    value={row.menuItemId} 
                                    onChange={(e) => handleUpdateSaleItemRow(idx, 'menuItemId', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                    required
                                  >
                                    <option value="" disabled>Select Item...</option>
                                    {menu.map(m => <option key={m.id} value={m.id}>{m.name} - ${m.sellingPrice.toFixed(2)}</option>)}
                                  </select>
                                </div>
                                <div className="w-20">
                                  <input 
                                    type="number" 
                                    min="1"
                                    value={row.qty} 
                                    onChange={(e) => handleUpdateSaleItemRow(idx, 'qty', parseInt(e.target.value) || 0)} 
                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none text-center"
                                  />
                                </div>
                                <div className="w-24 text-right font-bold text-slate-700">
                                    ${menuItem ? (menuItem.sellingPrice * row.qty).toFixed(2) : '0.00'}
                                </div>
                                <button type="button" onClick={() => handleRemoveSaleItemRow(idx)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-sm font-bold text-slate-400 uppercase">Total Amount</span>
                        <span className="text-3xl font-black text-slate-900">
                            ${draftSalesItems.reduce((acc, row) => {
                                const m = menu.find(i => i.id === row.menuItemId);
                                return acc + (m ? m.sellingPrice * row.qty : 0);
                            }, 0).toFixed(2)}
                        </span>
                    </div>
                    <button type="submit" className="w-full py-4 bg-sky-600 text-white rounded-2xl font-bold hover:bg-sky-700 shadow-xl shadow-sky-100 text-lg">
                        Complete Sale
                    </button>
                </div>
            </form>
          </div>
         </div>
      )}
    </div>
  );
};

export default App;