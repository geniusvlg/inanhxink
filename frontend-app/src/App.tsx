import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { FeatureFlagsProvider, useFeatureFlags, type FeatureFlags } from './contexts/FeatureFlagsContext';
import OrderPage from './pages/OrderPage';
import PaymentPage from './pages/PaymentPage';
import QrGeneratePage from './pages/QrGeneratePage';
import TemplatePreviewPage from './pages/TemplatePreviewPage';
import ThiepPage from './pages/ThiepPage';
import KhungAnhPage from './pages/KhungAnhPage';
import ScrapbookPage from './pages/ScrapbookPage';
import QrYeuThuongPage from './pages/QrYeuThuongPage';
import KhacPage from './pages/KhacPage';
import InAnhPage from './pages/InAnhPage';
import SetQuaTangPage from './pages/SetQuaTangPage';
import ProductDetailPage from './pages/ProductDetailPage';
import TestimonialsPage from './pages/TestimonialsPage';
import HomePage from './pages/HomePage';
import FloatingContact from './components/FloatingContact';
import type { ReactElement } from 'react';

// Always send `/` to the cute homepage.
function HomeRedirect() {
  return <Navigate to="/home" replace />;
}

// Renders `element` when the flag is enabled, otherwise redirects to `/home`.
function FlaggedRoute({ flag, element }: { flag: keyof FeatureFlags; element: ReactElement }) {
  const flags = useFeatureFlags();
  return flags[flag] ? element : <HomeRedirect />;
}

// Scrolls to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/payment/:qrName" element={<PaymentPage />} />
      <Route path="/qr/:qrName" element={<QrGeneratePage />} />
      <Route path="/preview/:templateName" element={<TemplatePreviewPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/danh-gia" element={<TestimonialsPage />} />

      <Route path="/qr-yeu-thuong"     element={<FlaggedRoute flag="page_qr_yeu_thuong"     element={<QrYeuThuongPage />} />} />
      <Route path="/thiep"             element={<FlaggedRoute flag="page_thiep"             element={<ThiepPage />} />} />
      <Route path="/khung-anh"         element={<FlaggedRoute flag="page_khung_anh"         element={<KhungAnhPage />} />} />
      <Route path="/so-scrapbook"      element={<FlaggedRoute flag="page_so_scrapbook"      element={<ScrapbookPage />} />} />
      <Route path="/set-qua-tang"      element={<FlaggedRoute flag="page_set_qua_tang"      element={<SetQuaTangPage />} />} />
      <Route path="/cac-san-pham-khac" element={<FlaggedRoute flag="page_cac_san_pham_khac" element={<KhacPage />} />} />
      <Route path="/in-anh"            element={<FlaggedRoute flag="page_in_anh"            element={<InAnhPage />} />} />
    </Routes>
    </>
  );
}

function App() {
  return (
    <FeatureFlagsProvider>
      <AppRoutes />
      <FloatingContact />
    </FeatureFlagsProvider>
  );
}

export default App;
