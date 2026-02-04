import { Routes, Route } from 'react-router-dom';
import OrderPage from './pages/OrderPage';
import QrCodePage from './pages/QrCodePage';
import TemplatePreviewPage from './pages/TemplatePreviewPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderPage />} />
      <Route path="/preview/:templateName" element={<TemplatePreviewPage />} />
      <Route path="/:qrName" element={<QrCodePage />} />
    </Routes>
  );
}

export default App;

