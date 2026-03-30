import './PageLoader.css';

export default function PageLoader() {
  return (
    <div className="page-loader">
      <img src="/loading.gif" alt="Đang tải..." className="page-loader-gif" />
    </div>
  );
}
