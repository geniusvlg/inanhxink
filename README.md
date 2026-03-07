# inanhxink.com - QR Code Ordering System

## Features

- 🎨 **Template Selection** - Choose from 10 beautiful templates
- 🔤 **Custom QR Names** - Create unique subdomains (name.inanhxink.com)
- ✍️ **Content Editor** - Add custom messages (max 11 lines, 7 chars per line)
- 🎁 **Keychain Option** - Optional QR keychain purchase
- 💝 **Tip System** - Add tips to show extra love
- 🎫 **Voucher Codes** - Support for discount vouchers
- 💳 **Order Management** - Complete order processing system

## Project Structure

```
.
├── frontend/          # React application (Vite)
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
├── backend/           # Node.js/Express API server
│   ├── routes/        # API routes
│   ├── config/       # Database configuration
│   └── database/     # Schema and seed data
└── postgres-data/     # PostgreSQL data directory
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Docker (for PostgreSQL)

## Setup Instructions

### 1. Start PostgreSQL Database

Make sure PostgreSQL is running in Docker:

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  -v /Users/nghy/Desktop/inanhxink/postgres-data:/var/lib/postgresql \
  postgres:latest
```

### 2. Initialize Database

```bash
cd backend
npm install
npm run db:init
```

This will create all necessary tables and seed sample data (templates and vouchers).

### 3. Start Backend Server

```bash
cd backend
npm run dev
```

The backend server will run on `http://localhost:3001`

### 4. Start Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

## Environment Variables

### Backend (.env)

Create a `.env` file in the `backend` directory:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mysecretpassword
DB_NAME=mydb
PORT=3001
NODE_ENV=development
```

## API Endpoints

### Templates
- `GET /api/templates` - Get all active templates
- `GET /api/templates/:id` - Get template by ID

### Orders
- `POST /api/orders/check-qr-name` - Check if QR name is available
- `POST /api/orders` - Create a new order
- `GET /api/orders/:id` - Get order by ID

### Vouchers
- `POST /api/vouchers/validate` - Validate voucher code

## Sample Voucher Codes

- `WELCOME10` - 10% discount
- `LOVE20` - 20% discount
- `SAVE5000` - 5,000đ discount

## Database Schema

### Tables
- **templates** - Available QR code templates
- **qr_codes** - Generated QR codes
- **orders** - Customer orders
- **vouchers** - Discount vouchers

## Development

- Backend uses `nodemon` for auto-restart on file changes
- Frontend uses Vite for fast HMR (Hot Module Replacement)
- CORS is enabled for frontend-backend communication

## Usage

1. Select a template from the grid
2. Enter a QR name (e.g., "anhyeuem") and check availability
3. Add your custom content (max 11 lines, 7 chars per line)
4. Optionally purchase a keychain
5. Add a tip if desired
6. Enter a voucher code (optional)
7. Review total and submit order

## Technologies Used

- **Frontend**: React, Vite, Axios
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Styling**: CSS3 with custom animations

## License

ISC
