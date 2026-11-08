# Studio Matra — HR & Payroll Frontend Application

Modern React 19 + TypeScript + Tailwind CSS v4 single-page application with modular routing for Studio Matra architecture firm.

---

## 🎨 Design & Branding
- **Official Logo:** Studio Matra architectural grid logo (`/logo.png`, `/logo-gold.png`, `/logo-white.png`)
- **Primary Brand Color:** `#CAA05C` (Warm Architectural Gold)
- **Timezone:** Asia/Dhaka (GMT+6)
- **Currency:** BDT (৳)

---

## 📁 Directory Structure
```
frontend/
├── public/               # Static assets & logos (official Studio Matra logo & icons)
├── src/
│   ├── assets/           # Bundled brand assets
│   ├── components/       # Reusable modular UI components (Header, Sidebar, Modals, Views)
│   ├── context/          # React AppContext (Auth state, reactive DB sync, Kiosk modal)
│   ├── db/               # Local repository with sync engine
│   ├── pages/            # Dedicated modular page components:
│   │   ├── DashboardPage.tsx
│   │   ├── AttendancePage.tsx
│   │   ├── EmployeesPage.tsx
│   │   ├── LeavePage.tsx
│   │   ├── PayrollPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── routes/           # React Router declarative routing
│   ├── services/         # API client, PDF payslip generation (jsPDF) & CSV export
│   ├── test/             # Automated test suite
│   ├── types/            # TypeScript schemas & contracts
│   ├── utils/            # Business logic (Dhaka attendance engine, 8-step BDT payroll, permissions)
│   ├── App.tsx
│   ├── index.css         # Tailwind v4 theme configuration with #CAA05C primary
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts        # Vite configuration with API proxy to port 5000
```

---

## 🚀 Running the Frontend

```bash
# From within frontend/
npm run dev

# Or from workspace root
npm run dev:frontend
```

The app will be accessible at `http://localhost:3000`.

### API Proxy
All requests to `/api` are automatically proxied to the backend at `http://localhost:5000` via `vite.config.ts`.

