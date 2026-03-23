import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './KhungAnhPage.css';

function KhungAnhPage() {
  return (
    <div className="khuganh-page">
      <SiteHeader activePage="khung-anh" />

      <section className="khuganh-hero">
        <h1 className="khuganh-hero-title">Khung Ảnh <span>Đẹp</span></h1>
        <p className="khuganh-hero-desc">Trang trí ảnh của bạn với những khung ảnh độc đáo và ý nghĩa.</p>
      </section>

      <section className="khuganh-content">
        <p className="khuganh-coming-soon">🖼️ Tính năng đang được phát triển. Hãy quay lại sớm nhé!</p>
      </section>
      <SiteFooter />
    </div>
  );
}

export default KhungAnhPage;
