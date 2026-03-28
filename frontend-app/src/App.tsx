import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OrderPage from './pages/OrderPage';
import PaymentPage from './pages/PaymentPage';
import QrCodePage from './pages/QrCodePage';
import QrGeneratePage from './pages/QrGeneratePage';
import TemplatePreviewPage from './pages/TemplatePreviewPage';
import ThiepPage from './pages/ThiepPage';
import KhungAnhPage from './pages/KhungAnhPage';
import QrYeuThuongPage from './pages/QrYeuThuongPage';
import ProductDetailPage from './pages/ProductDetailPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/payment/:qrName" element={<PaymentPage />} />
      <Route path="/qr/:qrName" element={<QrGeneratePage />} />
      <Route path="/preview/:templateName" element={<TemplatePreviewPage />} />
      <Route path="/thiep" element={<ThiepPage />} />
      <Route path="/khung-anh" element={<KhungAnhPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/qr-yeu-thuong" element={<QrYeuThuongPage />} />
      <Route path="/:qrName" element={<QrCodePage />} />
    </Routes>
  );
}

export default App;

