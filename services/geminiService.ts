import { GoogleGenAI, Type } from "@google/genai";
import { Ingredient, MenuItem, Reservation, AIAnalysisResponse, Sale, ParsedInvoice } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to clean JSON string from Markdown code blocks or extraneous text
const cleanJsonText = (text: string): string => {
  if (!text) return "{}";
  
  // 1. Try to find the first '{' and last '}' to extract the JSON object
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    return text.substring(firstOpen, lastClose + 1);
  }
  
  // 2. Fallback: Clean markdown wrappers if standard extraction failed
  let clean = text.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
  return clean.trim();
};

export const analyzeMargins = async (
  ingredients: Ingredient[],
  menu: MenuItem[],
  reservations: Reservation[],
  sales: Sale[],
  dateContext: { start: string; end: string }
): Promise<AIAnalysisResponse> => {
  const totalPax = reservations.reduce((acc, res) => acc + res.pax, 0);
  
  // Calculate top selling items from sales
  const itemCounts: Record<string, number> = {};
  sales.forEach(sale => {
      sale.items.forEach(item => {
          itemCounts[item.menuItemId] = (itemCounts[item.menuItemId] || 0) + item.qty;
      });
  });
  
  const payload = {
    analysis_period: `${dateContext.start} to ${dateContext.end}`,
    reservations_count: totalPax,
    sales_volume_in_period: sales.length,
    top_selling_items: Object.entries(itemCounts).map(([id, qty]) => {
        const m = menu.find(i => i.id === id);
        return { name: m?.name || id, qty };
    }),
    market_updates: ingredients.map(i => ({
      ingredient: i.name,
      new_price_per_unit: i.currentMarketPrice,
      unit: i.unit
    })),
    current_inventory: ingredients.map(i => ({
      ingredient: i.name,
      qty: i.currentStock,
      unit: i.unit,
      supplier_name: i.supplierName || 'Unknown Supplier',
      supplier_contact: i.supplierContact || ''
    })),
    menu_recipes: menu.map(m => ({
      dish_name: m.name,
      selling_price: m.sellingPrice,
      ingredients: m.ingredients.map(ri => {
        const ing = ingredients.find(i => i.id === ri.ingredientId);
        return { name: ing?.name || 'Unknown', qty: ri.qty };
      })
    }))
  };

  // Using gemini-3-flash-preview for faster and often more strictly structured JSON responses
  // compared to the preview pro model for this specific dashboard task.
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: JSON.stringify(payload),
    config: {
      maxOutputTokens: 8192, // Increased token limit to prevent truncation
      systemInstruction: `You are the "Margin Defender" AI for a restaurant. 
Your goal is to protect profit margins and prevent stockouts. 
Analyze the input payload which contains Inventory, MenuRecipes, Reservations, Past Sales, and MarketPriceUpdates for a specific date range.

Tasks:
1. Forecast Inventory: Calculate total required ingredients based on the reservation count AND sales trends.
2. Re-Cost Menu: Recalculate the cost of every dish using provided prices.
3. Analyze Margins: Compare New Cost vs Selling Price. 
   - CRITICAL ALERT: Margin < 20%.
   - WARNING: Margin < 35%.
4. Suggest Actions & Draft Content:
   - For STOCKOUTS: Generate a professional "SUPPLIER_EMAIL" draft. Include a 10% safety buffer in the quantity. If deficit > 50%, flag as URGENT in subject. Use the provided supplier info.
   - For LOW MARGINS: Suggest a "PRICE_UPDATE". Calculate the new price needed to reach ~35% margin.
   - For other high margin menus that has potential to cover the margin lost, suggest to increase the menu sales + discounted price or menu combos that can increase sales while increasing the overal profit margin.

Return ONLY a valid JSON object matching the requested schema. Do not include Markdown formatting.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis_summary: { type: Type.STRING },
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "STOCKOUT or MARGIN" },
                item_name: { type: Type.STRING },
                severity: { type: Type.STRING, description: "HIGH or MEDIUM" },
                message: { type: Type.STRING },
                suggested_action: { type: Type.STRING }
              },
              required: ["type", "item_name", "severity", "message", "suggested_action"]
            }
          },
          procurement_list: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ingredient: { type: Type.STRING },
                required_qty: { type: Type.NUMBER },
                current_qty: { type: Type.NUMBER },
                to_buy: { type: Type.NUMBER }
              },
              required: ["ingredient", "required_qty", "current_qty", "to_buy"]
            }
          },
          quick_actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["SUPPLIER_EMAIL", "PRICE_UPDATE"] },
                title: { type: Type.STRING },
                reason: { type: Type.STRING },
                email_recipient: { type: Type.STRING },
                email_subject: { type: Type.STRING },
                email_body: { type: Type.STRING },
                menu_item_name: { type: Type.STRING },
                suggested_price: { type: Type.NUMBER }
              },
              required: ["type", "title", "reason"]
            }
          }
        },
        required: ["analysis_summary", "alerts", "procurement_list", "quick_actions"]
      }
    }
  });

  const cleanText = cleanJsonText(response.text || '{}');
  const result = JSON.parse(cleanText);
  return result as AIAnalysisResponse;
};

export const parseInvoiceImage = async (base64Image: string): Promise<ParsedInvoice> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      },
      {
        text: "Extract inventory items from this invoice. For each item, find the Name, Quantity (number), Unit (e.g. kg, lbs, case, or 'unit' if unsure), and Price per Unit (numeric value only). Also find the Supplier Name. If a unit price is not explicitly stated, calculate it from Total Price / Quantity."
      }
    ],
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                supplierName: { type: Type.STRING, description: "Name of the supplier found on invoice header" },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            qty: { type: Type.NUMBER },
                            unit: { type: Type.STRING },
                            unitPrice: { type: Type.NUMBER }
                        },
                        required: ["name", "qty", "unit", "unitPrice"]
                    }
                }
            },
            required: ["supplierName", "items"]
        }
    }
  });

  const cleanText = cleanJsonText(response.text || '{"supplierName": "Unknown", "items": []}');
  return JSON.parse(cleanText) as ParsedInvoice;
};