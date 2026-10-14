import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute, { HomeRedirect } from './components/ProtectedRoute';
import { Permit, PermitSystem } from './components/Permit';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import QrOrdersPage from './pages/QrOrdersPage';
import ProductOrdersPage from './pages/ProductOrdersPage';
import VouchersPage from './pages/VouchersPage';
import ConfigPage from './pages/ConfigPage';
import ThiepPage from './pages/ThiepPage';
import KhungAnhPage from './pages/KhungAnhPage';
import ScrapbookPage from './pages/ScrapbookPage';
import KhacPage from './pages/KhacPage';
import SetQuaTangPage from './pages/SetQuaTangPage';
import InAnhPage from './pages/InAnhPage';
import CategoriesPage from './pages/CategoriesPage';
import TestimonialsPage from './pages/TestimonialsPage';
import BannersPage from './pages/BannersPage';
import HeroShotsPage from './pages/HeroShotsPage';
import FeaturedOnHomePage from './pages/FeaturedOnHomePage';
import FulfillmentPage from './pages/FulfillmentPage';
import ProductReviewsPage from './pages/ProductReviewsPage';
import RolesPage from './pages/RolesPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<HomeRedirect />} />
              <Route path="/products" element={<Permit area="qr_templates"><ProductsPage /></Permit>} />
              <Route path="/thiep" element={<Permit area="thiep"><ThiepPage /></Permit>} />
              <Route path="/khung-anh" element={<Permit area="khung_anh"><KhungAnhPage /></Permit>} />
              <Route path="/so-scrapbook" element={<Permit area="so_scrapbook"><ScrapbookPage /></Permit>} />
              <Route path="/cac-san-pham-khac" element={<Permit area="khac"><KhacPage /></Permit>} />
              <Route path="/set-qua-tang" element={<Permit area="set_qua_tang"><SetQuaTangPage /></Permit>} />
              <Route path="/in-anh" element={<Permit area="in_anh"><InAnhPage /></Permit>} />
              <Route path="/featured-on-home" element={<Permit area="featured"><FeaturedOnHomePage /></Permit>} />
              <Route path="/categories" element={<Permit area="categories"><CategoriesPage /></Permit>} />
              <Route path="/product-reviews" element={<Permit area="product_reviews"><ProductReviewsPage /></Permit>} />
              <Route path="/orders" element={<Permit area="product_orders"><ProductOrdersPage /></Permit>} />
              <Route path="/qr-orders" element={<Permit area="qr_orders"><QrOrdersPage /></Permit>} />
              <Route path="/fulfillment" element={<Permit area="fulfillment"><FulfillmentPage /></Permit>} />
              <Route path="/vouchers" element={<Permit area="vouchers"><VouchersPage /></Permit>} />
              <Route path="/testimonials" element={<Permit area="testimonials"><TestimonialsPage /></Permit>} />
              <Route path="/banners" element={<Permit area="banners"><BannersPage /></Permit>} />
              <Route path="/hero-shots" element={<Permit area="hero_shots"><HeroShotsPage /></Permit>} />
              <Route path="/config" element={<Permit area="config"><ConfigPage /></Permit>} />
              <Route path="/ho-so" element={<ProfilePage />} />
              <Route path="/vai-tro" element={<PermitSystem><RolesPage /></PermitSystem>} />
              <Route path="/nhan-vien" element={<PermitSystem><UsersPage /></PermitSystem>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
