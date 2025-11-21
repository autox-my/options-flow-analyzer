# Options Flow Analyzer 🌊

**Options Flow Analyzer** is a sophisticated, client-side React application designed to visualize and interpret institutional options order flow. It transforms raw CSV exports from platforms like Cheddar Flow into actionable market intelligence, helping traders spot "Whale" activity, momentum shifts, and structural support/resistance levels.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![React](https://img.shields.io/badge/React-18-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38bdf8)


https://github.com/user-attachments/assets/fc80269a-9537-4fae-b64d-1be79d60c8ef


## 🚀 Features

### 1. Interactive Visualization
* **Tornado Chart (Strike Price Analysis):** A vertical bar chart displaying Strike Prices on the Y-Axis.
    * **Green Bars:** Call buying/selling activity.
    * **Red Bars:** Put buying/selling activity.
    * **Whale Splitting:** Bars are segmented to visually distinguish "Normal" retail flow from "Whale" institutional flow (Darker shades).
    * **Fixed Axis:** The top X-axis remains sticky while you scroll through strike prices, ensuring data readability.
* **Momentum Line Chart:** A time-series chart tracking the **Net Cumulative Flow** (Bullish - Bearish premium) throughout the trading day.
    * **Dual Axis:** Includes a secondary Y-axis plotting the underlying asset's **Spot Price** to easily spot divergences (e.g., Price falling while Flow rises).
    * **Moving Average (MA):** Optional toggle to overlay a moving average line to gauge trend strength and reversals.
    * **Dynamic LOD:** Automatic data downsampling ("bucketing") ensures smooth performance even with thousands of data points.

### 2. Smart Data Management
* **Multi-Dataset Support:** Import multiple CSV files at once (e.g., different time blocks from the same day).
* **Intelligent Deduplication:** Automatically detects and removes duplicate trades if datasets overlap (e.g., File 1 ends at 2:00 PM, File 2 starts at 1:55 PM).
* **Project Saving:** Save your entire workspace (all loaded datasets) as a single `.json` project file and reload it later to pick up exactly where you left off.
* **Data Deletion:** Manage your workspace by removing specific datasets via the "Database" menu.

### 3. Dynamic Analysis
* **Metric Toggle:** Switch the entire dashboard view between **Premium ($)** (Dollar value / Conviction) and **Volume (#)** (Contract count / Liquidity).
* **Filtering:** Filter data by:
    * **Expiration Date** (Dynamic list based on loaded data).
    * **Minimum Premium/Size** (e.g., Show only trades > $500k).
* **Dashboard Stats:** Real-time summary cards for Total Call/Put Premium, Put/Call Ratio (PCR), and the Most Active Strike Level.

### 4. AI-Powered Insights 🤖
* **Sentiment Analysis:** One-click generation of an executive summary using Google's Gemini LLM. The AI analyzes the *currently filtered* view to provide context-aware commentary on trends, divergences, and whale positioning.
* **"Ask the Data" Chat:** A natural language interface to query your specific dataset (e.g., "What is the biggest bearish trade today?").

---

## 🛠️ How to Build & Deploy Locally

This project is built with **Vite + React** and uses **Tailwind CSS** for styling.

### Prerequisites
* **Node.js** (v16 or higher) installed on your machine.
* A **Google Gemini API Key** (Get one for free [here](https://aistudio.google.com/app/apikey)).

### Installation Steps

1.  **Clone or Create the Project**
    Open your terminal and run:
    ```bash
    npm create vite@latest options-flow-analyzer -- --template react
    cd options-flow-analyzer
    ```

2.  **Install Dependencies**
    Install the required libraries for charts, icons, and styling:
    ```bash
    npm install recharts lucide-react @tailwindcss/vite tailwindcss
    ```

3.  **Configure Tailwind CSS**
    * Update `vite.config.js` to include the Tailwind plugin:
        ```javascript
        import { defineConfig } from 'vite'
        import react from '@vitejs/plugin-react'
        import tailwindcss from '@tailwindcss/vite'

        export default defineConfig({
          plugins: [react(), tailwindcss()],
        })
        ```
    * Update `src/index.css`. Delete everything and add:
        ```css
        @import "tailwindcss";
        ```

4.  **Add the Application Code**
    * Copy the source code into `src/App.jsx`.
    * **Important:** Open `src/App.jsx` and paste your API Key into the `apiKey` constant at the top of the file.

5.  **Run the App**
    Start the local development server:
    ```bash
    npm run dev
    ```
    Open the link shown in your terminal (usually `http://localhost:5173`).

---

## 💡 Usage Tips

* **Identifying Reversals:** Look at the **Momentum Chart**. If the Asset Price (Purple Line) is making a "Lower Low" but the Net Flow (Blue Line) is making a "Higher Low," this is a classic **Bullish Divergence** signaling a potential bounce.
* **Whale Watching:** Switch the filter to **Min: > $100k** or **> $500k**. The Tornado Chart will filter out retail noise, showing you exactly where the big institutional money is positioning.
* **Automation:** While the app is manual import-based, you can use the provided Python script (see `scripts/` folder if applicable) to automate downloading exports from Cheddar Flow using Playwright + Gmail API.
