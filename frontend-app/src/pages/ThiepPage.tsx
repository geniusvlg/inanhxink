import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './ThiepPage.css';

function ThiepPage() {
  return (
    <div className="thiep-page">
      <SiteHeader activePage="thiep" />

      <section className="thiep-hero">
        <h1 className="thiep-hero-title">Thiệp <span>Của Bạn</span></h1>
        <p className="thiep-hero-desc">Tạo thiệp cá nhân độc đáo, gửi trao yêu thương đến người thân.</p>
      </section>

      <section className="thiep-content">
        <p className="thiep-coming-soon">🎴 Tính năng đang được phát triển. Hãy quay lại sớm nhé!</p>
      </section>
      <SiteFooter />
    </div>
  );
}

export default ThiepPage;
