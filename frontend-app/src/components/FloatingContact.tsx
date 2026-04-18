import './FloatingContact.css';

const INSTAGRAM_URL = 'https://www.instagram.com/inanhxink';
const TIKTOK_URL = 'https://www.tiktok.com/@miuynstore';
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61579688101318';
const ZALO_URL = 'https://zalo.me/0582818580';

export default function FloatingContact() {
  return (
    <div className="floating-contact" aria-label="Liên hệ">
      <div className="fc-button fc-tiktok">
        <a
          href={TIKTOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
        >
          <svg width="22" height="22" viewBox="0 0 448 512" fill="#fff" aria-hidden="true">
            <path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z" />
          </svg>
        </a>
        <span className="fc-circle fc-circle-1" />
        <span className="fc-circle fc-circle-2" />
        <span className="fc-circle fc-circle-3" />
      </div>

      <div className="fc-button fc-instagram">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <radialGradient id="ig-bg" cx="28%" cy="102%" r="140%">
                <stop offset="0%" stopColor="#ffd676" />
                <stop offset="25%" stopColor="#f2a454" />
                <stop offset="38%" stopColor="#e8654c" />
                <stop offset="55%" stopColor="#d93175" />
                <stop offset="72%" stopColor="#c32e87" />
                <stop offset="100%" stopColor="#4c63d2" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="32" height="32" rx="8" ry="8" fill="url(#ig-bg)" />
            <rect x="6" y="6" width="20" height="20" rx="5.5" ry="5.5" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="16" cy="16" r="4.5" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="22.2" cy="9.8" r="1.25" fill="#fff" />
          </svg>
        </a>
        <span className="fc-circle fc-circle-1" />
        <span className="fc-circle fc-circle-2" />
        <span className="fc-circle fc-circle-3" />
      </div>

      <div className="fc-button fc-facebook">
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </a>
        <span className="fc-circle fc-circle-1" />
        <span className="fc-circle fc-circle-2" />
        <span className="fc-circle fc-circle-3" />
      </div>

      <div className="fc-button fc-zalo">
        <a
          href={ZALO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nhắn tin Zalo"
        >
          <img src="/zalo_icon.svg.webp" alt="Zalo" />
        </a>
        <span className="fc-circle fc-circle-1" />
        <span className="fc-circle fc-circle-2" />
        <span className="fc-circle fc-circle-3" />
      </div>
    </div>
  );
}
