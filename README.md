# Chef's Margin - AI Restaurant Management MVP

Chef's Margin is a B2B SaaS web application designed to help restaurant owners and chefs protect their profit margins and automate inventory management using Google's Gemini AI.

## 🚀 Overview

Running a restaurant involves tight margins and volatile ingredient prices. Chef's Margin acts as an intelligent "Margin Defender" that:
1.  **Tracks** real-time ingredient costs and stock levels.
2.  **Analyzes** sales data and reservation forecasts.
3.  **Predicts** stockouts before they happen.
4.  **Alerts** users when recipe costs rise, eroding profit margins.
5.  **Automates** procurement with AI-drafted supplier emails and invoice scanning.

## ✨ Key Features

### 🤖 AI Margin Defender
- **Contextual Analysis:** Uses **Gemini 1.5 Flash** to analyze specific date ranges of sales and reservations against current inventory.
- **Profit Protection:** Automatically flags menu items where the margin has dropped below 20% due to rising ingredient costs.
- **Smart Recommendations:** Suggests price updates or menu engineering tactics to recover lost profits.

### 📸 AI Invoice Scanning
- **Visual Parsing:** Upload or take a photo of a physical supplier invoice.
- **Auto-Update:** The AI extracts line items, quantities, and unit prices to automatically update inventory stock and current market prices.

### 📦 Inventory & Market Management
- **Live Stock Tracking:** Monitor current stock levels and supplier details.
- **Market Price Variance:** Visual indicators (Green/Red) showing how current market prices compare to base prices.
- **Supplier Quick Actions:** One-click generation of restocking emails based on AI-calculated deficits.

### 🍳 Menu Engineering
- **Dynamic Costing:** Recipe costs update automatically when ingredient prices change.
- **Visual Insights:** Bar charts and margin indicators identify top-performing and under-performing dishes.
- **Recipe Builder:** Intuitive interface to create complex recipes from inventory items.

### 📅 Sales & Bookings
- **Unified View:** Combine historical sales data with future reservation info.
- **Forecasting:** The AI uses "Pax" (passenger/guest) counts from reservations to predict future ingredient demand.

### 🕰️ Analysis History
- **Audit Trail:** Automatically saves every AI analysis report.
- **Timeline:** Review past alerts, suggested actions, and financial summaries with timestamps.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **AI Integration:** Google GenAI SDK (`@google/genai`)
- **Models Used:**
    - `gemini-3-flash-preview` (Logic, Math, JSON Analysis)
    - `gemini-3-flash-preview` (Vision/Image Processing for Invoices)
- **Visualization:** Recharts
- **Icons:** Lucide React
- **Persistence:** LocalStorage (Browser-based persistence for MVP)

## ⚡ Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kusyuk/cheft-margin.git
    cd cheft-margin
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure API Key:**
    *   Obtain a Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
    *   Set the environment variable `API_KEY` (or `REACT_APP_API_KEY` depending on your build tool) in your environment.
    *   *Note: The MVP code expects `process.env.API_KEY` to be available.*

4.  **Run the application:**
    ```bash
    npm start
    ```

## 📱 Usage Guide

1.  **Dashboard:** Select a date range to view revenue, costs, and margins. Click **"Run Margin AI"** to generate a fresh analysis.
2.  **Inventory:** Click **"Scan Invoice"** to upload a receipt image, or manually add ingredients.
3.  **Menu:** Create recipes by linking ingredients. Watch the margin % change in real-time as you adjust prices.
4.  **History:** Visit the "Analysis History" tab to see previous AI recommendations and ensure no action items were missed.

## 📄 License

This project is an MVP prototype and is available for educational and demonstration purposes.