import './SiteFooter.css';

function SiteFooter() {
  return (
    <footer className="homepage-footer">
      <div className="footer-content">
        <div className="footer-info">
          <p>Inanhxink — Quà tặng cá nhân hóa, dành tặng người thương</p>
          <p>&copy; {new Date().getFullYear()} Inanhxink. All rights reserved.</p>
        </div>

        <div className="footer-payments">
          <div className="footer-payments-section">
            <h4>THANH TOÁN</h4>
            <div className="footer-badge-grid">
              <div className="logo-badge"><img src="/assets/images/payment/visa.png" alt="VISA" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/payment/mastercard.png" alt="Mastercard" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/payment/banking.png" alt="Banking" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/payment/cod.png" alt="COD" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/payment/momo.png" alt="MoMo" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/payment/paypal.png" alt="PayPal" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
            </div>
          </div>
          <div className="footer-payments-section">
            <h4>ĐƠN VỊ VẬN CHUYỂN</h4>
            <div className="footer-badge-grid">
              <div className="logo-badge"><img src="/assets/images/shipping/spx.png" alt="SPX" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/ghn.png" alt="GHN" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/viettel-post.png" alt="Viettel Post" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/vietnampost.png" alt="Vietnam Post" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/jt-express.png" alt="J&T Express" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/grabexpress.png" alt="GrabExpress" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/ninjavan.png" alt="NinjaVan" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/be.png" alt="be" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
              <div className="logo-badge"><img src="/assets/images/shipping/ahamove.png" alt="Ahamove" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} /></div>
            </div>
          </div>
        </div>

        <div className="footer-social">
          <h4>Theo dõi inanhxink</h4>
          <a href="https://www.facebook.com/profile.php?id=61579688101318" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a href="https://www.instagram.com/inanhxink" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </a>
          <a href="https://www.tiktok.com/@miuynstore?_r=1&_t=ZS-94VUfEHUSri" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.71a8.21 8.21 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.14z"/></svg>
            TikTok
          </a>
          <a href="https://zalo.me/0582818580" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 01-.5763-.5729l-.0006.0005a3.273 3.273 0 01-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 011.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 01-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 01-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9436 0 1.0746.8697 1.9453 1.945 1.9453z"/></svg>
            0582818580
          </a>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
