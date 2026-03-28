import { Routes, Route, Navigate } from 'react-router-dom';
import { FeatureFlagsProvider, useFeatureFlags, type FeatureFlags } from './contexts/FeatureFlagsContext';
import HomePage from './pages/HomePage';
import OrderPage from './pages/OrderPage';
import PaymentPage from './pages/PaymentPage';
import QrCodePage from './pages/QrCodePage';
import QrGeneratePage from './pages/QrGeneratePage';
import TemplatePreviewPage from './pages/TemplatePreviewPage';
import ThiepPage from './pages/ThiepPage';
import KhungAnhPage from './pages/KhungAnhPage';
import ScrapbookPage from './pages/ScrapbookPage';
import QrYeuThuongPage from './pages/QrYeuThuongPage';
import ProductDetailPage from './pages/ProductDetailPage';
import type { ReactElement } from 'react';

// Redirects to / when the feature flag is disabled
function FlaggedRoute({ flag, element }: { flag: keyof FeatureFlags; element: ReactElement }) {
  const flags = useFeatureFlags();
  return flags[flag] ? element : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/payment/:qrName" element={<PaymentPage />} />
      <Route path="/qr/:qrName" element={<QrGeneratePage />} />
      <Route path="/preview/:templateName" element={<TemplatePreviewPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />

      <Route path="/qr-yeu-thuong" element={<FlaggedRoute flag="page_qr_yeu_thuong" element={<QrYeuThuongPage />} />} />
      <Route path="/thiep"         element={<FlaggedRoute flag="page_thiep"         element={<ThiepPage />} />} />
      <Route path="/khung-anh"     element={<FlaggedRoute flag="page_khung_anh"     element={<KhungAnhPage />} />} />
      <Route path="/so-scrapbook"  element={<FlaggedRoute flag="page_so_scrapbook"  element={<ScrapbookPage />} />} />

      <Route path="/:qrName" element={<QrCodePage />} />
    </Routes>
  );
}

function App() {
  return (
    <FeatureFlagsProvider>
      <AppRoutes />
    </FeatureFlagsProvider>
  );
}

export default App;
