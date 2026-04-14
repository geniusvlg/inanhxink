import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import VouchersPage from './pages/VouchersPage';
import ConfigPage from './pages/ConfigPage';
import ThiepPage from './pages/ThiepPage';
import KhungAnhPage from './pages/KhungAnhPage';
import ScrapbookPage from './pages/ScrapbookPage';
import KhacPage from './pages/KhacPage';
import SetQuaTangPage from './pages/SetQuaTangPage';
import InAnhPage from './pages/InAnhPage';
import CategoriesPage from './pages/CategoriesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/products" replace />} />
              <Route path="/products"         element={<ProductsPage />} />
              <Route path="/thiep"            element={<ThiepPage />} />
              <Route path="/khung-anh"        element={<KhungAnhPage />} />
              <Route path="/so-scrapbook"     element={<ScrapbookPage />} />
              <Route path="/cac-san-pham-khac" element={<KhacPage />} />
              <Route path="/set-qua-tang"     element={<SetQuaTangPage />} />
              <Route path="/in-anh"          element={<InAnhPage />} />
              <Route path="/categories"       element={<CategoriesPage />} />
              <Route path="/orders"           element={<OrdersPage />} />
              <Route path="/vouchers"         element={<VouchersPage />} />
              <Route path="/config"           element={<ConfigPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
