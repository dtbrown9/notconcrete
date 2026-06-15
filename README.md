# Not Concrete Cleaning Co.

A standalone full-stack website for a licensed, insured, state-registered, minority-owned cleaning business.

## What it includes

### 🌐 Public Website Features
- **Marketing Homepage** with premium layout and design
- **Services Section** offering:
  - Final cleaning on new construction projects
  - Mid-project cleaning
  - Pre-construction prep cleaning
  - Move-out and before-move-in cleaning (homes, apartments, offices)
  - Demo cleanup
  - Bulk trash removal
  - Commercial and residential power washing
  - Eviction cleanups
- **Before/After Gallery** showcasing completed projects
- **Testimonials Section** with customer reviews
- **Service Area Information** for coverage regions
- **Database-Backed Quote Request Form** with real-time submission
- **Responsive Design** optimized for mobile, tablet, and desktop

### 🔐 Admin Dashboard
- **Password-Protected Admin Panel** with secure authentication
- **Quote Management**:
  - View all submitted quote requests
  - Filter quotes by status (new, contacted, completed, archived)
  - Search quotes by customer name, email, phone, or address
  - Update quote status
  - Delete quotes
  - Export quotes to CSV
- **Settings Page**:
  - First-time password setup
  - Secure password changes
  - Password hashing with cryptographic salt
  - Session-based authentication

**Access Admin Panel**: Click "Admin" link in the mobile menu or navigate to `/admin`

## Tech Stack
- **Frontend**: React 19.1.1 + TypeScript 5.9.2 + Vite 7.0.6
- **Backend**: Express 5.1.0
- **Database**: SQLite (sql.js 1.13.0)
- **Testing**: Vitest 4.1.9 + React Testing Library
- **Styling**: Custom CSS with glass morphism design, dark theme, responsive layout

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
npm install
```

## Running the Application

### Development Mode
Start both frontend and backend with hot reload:

```bash
npm run dev
```

This command:
- Starts Vite dev server on **http://localhost:5173** (Frontend)
- Starts Express server on **http://localhost:3001** (API)
- Enables hot module reloading for React components
- Automatically watches for file changes

**Open in browser**: http://localhost:5173

### Production Build
```bash
npm run build
```
Builds optimized production bundle for deployment.

### Start Production Server
```bash
npm run start
```
Runs the production-built application.

## Testing

### Run All Tests
```bash
npm run test:run
```
Executes all 87 tests once. Perfect for CI/CD pipelines and validation before commits.

### Watch Mode (Development)
```bash
npm run test
```
Automatically re-runs tests when files change. Great for iterative development.

### Interactive Test Explorer
```bash
npm run test:ui
```
Opens a browser-based interface to explore test results, debug, and inspect individual tests.

### Coverage Report
```bash
npm run test:coverage
```
Generates an HTML coverage report showing test coverage metrics.

**Test Coverage**: 87 passing tests covering:
- ✅ Password management (setup, login, change password)
- ✅ Quote management (CRUD operations, search, filter, export)
- ✅ Authentication and authorization
- ✅ Error handling and edge cases
- ✅ Integration flows and data persistence

See [TEST_DOCUMENTATION.md](TEST_DOCUMENTATION.md) for detailed test information.

## Database

The backend creates a local SQLite database at `data/notconcrete.sqlite`:
- **Auto-initialization**: Database and schema created automatically on first run
- **Services Table**: Pre-populated with cleaning service types
- **Testimonials**: Sample customer testimonials
- **Gallery Items**: Before/after images
- **Service Areas**: Coverage regions
- **Quote Requests**: Customer quote submissions with status tracking
- **Admin Settings**: Admin password hash and salt for authentication

## API Endpoints

### Public Endpoints
- `GET /api/services` - Get all cleaning services
- `GET /api/testimonials` - Get customer testimonials
- `GET /api/gallery` - Get before/after gallery items
- `GET /api/service-areas` - Get service coverage areas
- `POST /api/quotes` - Submit a quote request

### Admin Endpoints (Password Protected)
- `GET /api/admin/setup-status` - Check if admin password is set
- `POST /api/admin/setup` - Create initial admin password
- `GET /api/admin/quotes` - Get all quote requests
- `PATCH /api/admin/quotes/:id` - Update quote status
- `DELETE /api/admin/quotes/:id` - Delete quote request
- `PATCH /api/admin/password` - Change admin password
- `GET /api/admin/quotes/export/csv` - Export quotes as CSV

## Admin Dashboard Guide

### First-Time Setup
1. Navigate to http://localhost:5173/admin
2. You'll see the "Set Admin Password" page
3. Enter a password (minimum 6 characters)
4. Confirm the password
5. Click "Set Password"
6. Your password is securely hashed and stored

### Logging In
1. Navigate to http://localhost:5173/admin
2. Enter your admin password
3. Click "Login"
4. Access the quote management dashboard

### Managing Quotes
- **Search**: Use the search box to find quotes by name, email, phone, or address
- **Filter**: Use the status dropdown to filter by (All, New, Contacted, Completed, Archived)
- **Update Status**: Click the status dropdown in any quote row to change its status
- **Delete**: Click the "Delete" button to remove a quote
- **Export**: Click "Export as CSV" to download all quotes as a spreadsheet

### Changing Your Password
1. Click the "Settings" button in the dashboard
2. Enter your current password
3. Enter your new password (minimum 6 characters)
4. Confirm your new password
5. Click "Change Password"
6. Your password is updated and securely stored

## Project Structure

```
notconcrete/
├── src/
│   ├── components/          # Reusable React components
│   ├── pages/              # Page components (HomePage, AdminDashboard)
│   ├── services/           # API service functions
│   ├── state/              # State management (auth, workspace, userSettings)
│   ├── routes/             # Router configuration
│   ├── __tests__/          # Test files
│   ├── styles-enhanced.css # Enhanced styling with animations
│   ├── App.tsx             # Main App component
│   └── main.tsx            # React entry point
├── server/
│   └── index.ts            # Express server and API endpoints
├── public/                 # Static assets
├── data/                   # SQLite database (created on first run)
├── vite.config.ts          # Vite configuration
├── vitest.config.ts        # Vitest configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Security Features

- ✅ **Password Hashing**: Admin passwords are hashed using scryptSync with random salt
- ✅ **Session Authentication**: Bearer token authentication for admin endpoints
- ✅ **Protected Routes**: Admin endpoints require password verification
- ✅ **Input Validation**: All form inputs validated before processing
- ✅ **CORS**: Cross-Origin Resource Sharing properly configured

## Styling & Design

- **Dark Theme**: Professional dark color scheme (#0a1220)
- **Cyan Accents**: Modern cyan (#7dd3fc) highlights and buttons
- **Glass Morphism**: Frosted glass effect cards and components
- **Responsive Layout**: Mobile-first design, works on all screen sizes
- **Smooth Animations**: Subtle transitions and hover effects
- **Typography**: Clean, readable fonts with proper hierarchy

## Browser Support

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers

## Troubleshooting

### Port Already in Use
If ports 5173 or 3001 are in use, you can configure them in `vite.config.ts` and `server/index.ts`.

### Database Issues
Delete `data/notconcrete.sqlite` to reset the database. It will be recreated on next run.

### Module Not Found
Run `npm install` again to ensure all dependencies are installed.

### Tests Failing
Run `npm run test:run` to see which tests are failing and check the error messages.

## Documentation

- [TEST_DOCUMENTATION.md](TEST_DOCUMENTATION.md) - Complete test suite documentation
- [TEST_USAGE_GUIDE.md](TEST_USAGE_GUIDE.md) - How to use and run tests
- [QUICK_TEST_REFERENCE.md](QUICK_TEST_REFERENCE.md) - Quick test commands reference

## License

Built for Not Concrete Cleaning Co.
