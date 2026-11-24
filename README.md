# Easy Due Tracker (Challan Track)

A modern, minimalist, offline-ready due tracking ledger designed with large, clear touch controls and intuitive navigation. Built for business owners and senior shopkeepers to effortlessly track and calculate customer dues, print receipts, and set up savings goals.

🚀 **Live App:** [https://obsiez.github.io/experimental-track2/](https://obsiez.github.io/experimental-track2/)

---

## ✨ Features

- **Intuitive Ledger & Dues Tracking**: Track customer balances, dues, and payments in real time.
- **Goal-Based Savings**: Integrated savings goal and deposit tracker.
- **Biometric Security**: Quick and secure app access using biometric authentication (fingerprint/face recognition).
- **Instant Receipt Generation**: Generate clean, printable PDF receipts via jsPDF.
- **Touch-Friendly Calculator Keypad**: Large, high-contrast keys for quick entry on mobile and tablet.
- **Multi-language Support**: Full English and Bengali language localization with phonetic typing support.
- **Dynamic Accent Themes**: Customizable color themes with dark and light mode support.
- **Offline-First PWA**: Progressive Web App capabilities with offline local caching and installable home screen icon.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation**: [Motion](https://motion.dev/)
- **Database & Sync**: [Firebase 13 / Firestore](https://firebase.google.com/) with persistent local cache
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment**: [GitHub Pages](https://pages.github.com/) via automated GitHub Actions CI/CD

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Obsiez/experimental-track2.git
   cd experimental-track2
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set up your Firebase or Gemini keys in `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_PROJECT_ID=challan-track
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

---

## 🚢 Deployment

Automated deployment is configured using GitHub Actions (`.github/workflows/deploy.yml`).
Every push to `main` automatically triggers a build and publishes the site to GitHub Pages.

To ensure GitHub Pages is enabled on your repo:
1. Go to **Settings > Pages** on your GitHub repository.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
