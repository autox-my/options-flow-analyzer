# Technical Specifications & Requirements

## 1. Core Functionality
* **App Type:** Single-Page Application (SPA) built with React (Vite).
* **Data Source:** CSV files exported from Cheddar Flow (specifically the "Options Order Flow" export).
* **Processing:** Purely client-side (Browser Memory). No external backend server required.
* **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`).

## 2. Data Handling Requirements
* **Input Formats:**
    * `.csv`: Raw exports containing columns: `date, time, symbol, expiry, strike, put_call, side, spot, size, price, premium`.
    * `.json`: Custom "Project Files" that bundle multiple datasets.
* **Multi-File Support:** Users must be able to import multiple CSV files sequentially.
* **Deduplication:** The app must smartly handle overlapping data to prevent double-counting.
    * **Logic:** Create a unique composite key (`date + time + symbol + strike + premium + size`).
* **Persistence:**
    * **State Management:** Data lives in React State.
    * **Save/Load:** Ability to serialize the current state (all datasets) into a JSON file for local saving/restoring.
    * **Optimization:** Save format uses "Compact Mode" (Arrays of Arrays) instead of Objects to reduce file size and prevent browser crashes.
    * **Deletion:** Ability to remove specific datasets individually via the "Database" manager.

## 3. Visualization Requirements

### A. Tornado Chart (Strike Analysis)
* **Orientation:** Vertical (Strike Price on Y-Axis).
* **Sorting:** High Strike Prices at the top, descending to Low Strike Prices at the bottom.
* **Axis Alignment:**
    * X-Axis must be **Symmetric** (`[-Max, +Max]`) so that `0` is perfectly centered.
    * X-Axis must be **Sticky** (fixed to the top) while the chart body scrolls vertically.
    * **Ticks:** Must calculate "Nice Numbers" (e.g., -10M, -5M, 0, 5M, 10M) to ensure clean labels.
* **Data Representation:**
    * **Right Side (Green):** Call Activity.
    * **Left Side (Red):** Put Activity.
    * **Segmentation:** Bars must be stacked to show "Normal" vs. "Whale" flow.
        * *Whale Definition (Premium Mode):* Trade Value ≥ $1,000,000.
        * *Whale Definition (Volume Mode):* Trade Size ≥ 1,000 contracts.

### B. Momentum Chart (Net Flow)
* **Type:** Line Chart.
* **X-Axis:** Time (Intraday).
* **Primary Y-Axis (Left):** Net Cumulative Flow (Calls - Puts).
* **Secondary Y-Axis (Right):** Asset Spot Price (derived from `spot` column in CSV).
* **Optimization:**
    * **Dynamic Bucketing (LOD):** Data must be downsampled based on duration (1-min, 15-min, or 1-hour buckets) to prevent rendering lag when datasets > 2,000 points.
* **Moving Average:**
    * Calculated on the Net Flow line.
    * **Toggle:** User can turn MA on/off.
    * **Configurable:** User can set the MA Length (default 300 trades).
    * **Signals:** Visual dots rendered at points where Net Flow crosses the MA (Green dot = Bullish Cross, Red dot = Bearish Cross).

## 4. Dashboard & Metrics
* **Top Level Metrics:**
    * Total Call Premium/Volume.
    * Total Put Premium/Volume.
    * Put/Call Ratio (PCR).
    * Most Active Strike Level.
* **Visuals:** "Percentage Rings" (Donut charts) next to Call/Put stats to visualize the ratio.
* **Metric Toggle:** A global switch to change ALL analysis between **Premium ($)** and **Volume (Contract Count)**.
* **Filtering:**
    * **Expiry:** Dropdown to filter by specific expiration dates.
    * **Min Value:** Dropdown to filter out small trades (e.g., show only > $10k, > $100k, > $500k). The dropdown values adapt based on the Metric (Premium vs Volume).

## 5. AI Integration (Gemini API)
* **Provider:** Google Gemini 2.5 Pro (via API Key).
* **Context Awareness:**
    * The prompt sent to the AI must reflect the **currently filtered view** (not just the raw file).
    * It must calculate and send: Net Flow Trend (Bullish/Bearish), Spot Price Trend, and any detected Divergences.
* **Features:**
    * **"Analyze Sentiment":** Generates a 3-sentence executive summary.
    * **"Ask the Data":** Chat interface for Q&A.
* **Formatting:** The output supports Markdown rendering (bolding, lists, tables).
