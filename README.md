# Digital Transaction Ledger CRM

  # Digital Transaction Ledger CRM

A modern Currency Exchange & Remittance Management System built with **Next.js 15** and **React 19**.

  This is a code bundle for Digital Transaction Ledger CRM. The original project is available at https://www.figma.com/design/fOcDTcJAU09RmGGqMJd1oC/Digital-Transaction-Ledger-CRM.

## Features

  ## Running the code

- 📊 Daily exchange rate management (EUR, USD, GBP, CAD)

- 👥 Client profile management  Run `npm i` to install the dependencies.

- 💱 Transaction tracking (Send/Receive)

- 🔍 Client search functionality  Run `npm run dev` to start the development server.

- 📈 Transaction history and analytics  
- 🎨 Modern UI with Tailwind CSS and Radix UI components

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **React**: React 19
- **TypeScript**: Full type safety
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI
- **Database**: Supabase
- **Icons**: Lucide React
- **Toast Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Digitaltransactionledgercrm
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create a `.env.local` file with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── loading.tsx        # Loading component
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   └── ...           # Feature components
│   ├── utils/            # Utility functions
│   └── index.css         # Global styles
├── next.config.js        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Migration from Vite to Next.js

This project was successfully migrated from Vite to Next.js 15, maintaining all functionality while gaining:
- Server-side rendering (SSR)
- Better SEO capabilities
- Improved performance
- Built-in routing
- API routes support

## License

Private project - All rights reserved
