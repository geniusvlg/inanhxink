import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import '../App.css';
import TemplateSelector from '../components/TemplateSelector';
import QrNameInput from '../components/QrNameInput';
import ContentEditor from '../components/ContentEditor';
import LetterInSpaceForm from '../components/LetterInSpaceForm';
import MusicOption from '../components/MusicOption';
import TipSelector from '../components/TipSelector';
import VoucherInput from '../components/VoucherInput';
import ImageUploader from '../components/ImageUploader';
import { type Template } from '../data/mockTemplates';
import { createOrder, uploadFiles, getTemplate, getMetadata } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

interface LoveDaysTimelineRow {
  date: string;
  text: string;
}

function OrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [qrName, setQrName] = useState('');
  const [qrNameValid, setQrNameValid] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [content, setContent] = useState('');
  const [musicAdded, setMusicAdded] = useState(false);
  const [musicLink, setMusicLink] = useState('');
  const [keychainPurchased, setKeychainPurchased] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | 'custom' | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState(0);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [letterTitle, setLetterTitle] = useState('Love Letter');
  const [letterHint, setLetterHint] = useState('');
  const [letterSignoff, setLetterSignoff] = useState('');
  const [letterSender, setLetterSender] = useState('');
  const [letterReceiver, setLetterReceiver] = useState('');
  // Love Days fields
  const [loveDaysDate, setLoveDaysDate] = useState('');
  const [loveDaysNameFrom, setLoveDaysNameFrom] = useState('');
  const [loveDaysNameTo, setLoveDaysNameTo] = useState('');
  const [loveDaysMessage, setLoveDaysMessage] = useState('');
  const [loveDaysTimeline, setLoveDaysTimeline] = useState<LoveDaysTimelineRow[]>([{ date: '', text: '' }]);
  // Birthday fields
  const [birthdayTitle, setBirthdayTitle] = useState('Happy Birthday');
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayAge, setBirthdayAge] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [birthdayDay = '', birthdayMonth = ''] = birthdayDate.split('.');
  const [birthdayFinalText, setBirthdayFinalText] = useState('');
  const [birthdayBackgroundText, setBirthdayBackgroundText] = useState('I LOVE YOU');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadedImages, setUploadedImages] = useState<(File | null)[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [musicPrice, setMusicPrice] = useState(10000);
  const [keychainPrice, setKeychainPrice] = useState(35000);

  // Background upload tracking: slot index → { promise, cancelled }
  const bgUploads = useRef<Map<number, { promise: Promise<string | null>; cancelled: boolean }>>(new Map());
  const [uploadStates, setUploadStates] = useState<Record<number, 'uploading' | 'done' | 'error'>>({});
  // Files selected before qrName was valid — flushed once qrName is validated
  const pendingFiles = useRef<{ index: number; file: File }[]>([]);

  const templateType = selectedTemplate?.template_type || '';
  const AVATAR_SLOTS = 2;
  const GALLERY_SLOTS = 10;
  const LOVEDAYS_MAX_IMAGES = AVATAR_SLOTS + GALLERY_SLOTS;

  const preselectedTemplateId = searchParams.get('template');

  // Fetch prices from metadata
  useEffect(() => {
    getMetadata().then(data => {
      if (data.music_price) setMusicPrice(parseInt(data.music_price));
      if (data.keychain_price) setKeychainPrice(parseInt(data.keychain_price));
    }).catch(() => {});
  }, []);

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    const draft = sessionStorage.getItem('orderFormDraft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.selectedTemplate) setSelectedTemplate(d.selectedTemplate);
        if (d.qrName) setQrName(d.qrName);
        if (d.qrNameValid) setQrNameValid(d.qrNameValid);
        if (d.qrUrl) setQrUrl(d.qrUrl);
        if (d.content) setContent(d.content);
        if (d.musicAdded) setMusicAdded(d.musicAdded);
        if (d.musicLink) setMusicLink(d.musicLink);
        if (d.keychainPurchased) setKeychainPurchased(d.keychainPurchased);
        if (d.selectedTip !== undefined) setSelectedTip(d.selectedTip);
        if (d.customTipAmount) setCustomTipAmount(d.customTipAmount);
        if (d.voucher) setVoucher(d.voucher);
        if (d.imagePreviews?.length) {
          setImagePreviews(d.imagePreviews);
          // Convert base64 previews back to File objects
          Promise.all(
            (d.imagePreviews as string[]).map(async (b64: string, i: number) => {
              if (!b64) return null;
              const res = await fetch(b64);
              const blob = await res.blob();
              return new File([blob], `image-${i}.jpg`, { type: blob.type });
            })
          ).then(files => setUploadedImages(files));
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('orderFormDraft');
    }
  }, []);

  // Auto-select template from URL param
  useEffect(() => {
    if (preselectedTemplateId && !selectedTemplate) {
      getTemplate(preselectedTemplateId).then((data) => {
        const t = data.template || data;
        setSelectedTemplate({ ...t, price: Number(t.price) });
      }).catch(() => {});
    }
  }, [preselectedTemplateId, selectedTemplate]);

  const calculateTotal = () => {
    let subtotal = selectedTemplate ? selectedTemplate.price : 0;
    if (musicAdded) subtotal += musicPrice;
    if (keychainPurchased) subtotal += keychainPrice;
    const tipAmount = selectedTip === 'custom' ? customTipAmount : (selectedTip || 0);
    subtotal += tipAmount;
    let total = subtotal;
    if (voucher) {
      if (voucher.discountType === 'percentage') {
        total = subtotal * (1 - voucher.discountValue / 100);
      } else {
        total = Math.max(0, subtotal - voucher.discountValue);
      }
    }
    return {
      subtotal: Math.round(subtotal),
      total: Math.round(total),
      discount: Math.round(subtotal - total),
    };
  };

  const handleQrNameValidation = (isValid: boolean, fullUrl?: string) => {
    setQrNameValid(isValid);
    setQrUrl(fullUrl || '');
  };

  const handleVoucherValidated = (voucherData: Voucher | null) => {
    setVoucher(voucherData);
  };

  const startUpload = (index: number, file: File, name: string) => {
    setUploadStates(prev => ({ ...prev, [index]: 'uploading' }));
    const entry: { promise: Promise<string | null>; cancelled: boolean } = { promise: null!, cancelled: false };
    entry.promise = uploadFiles([file], name)
      .then(urls => {
        if (entry.cancelled) return null;
        setUploadStates(prev => ({ ...prev, [index]: 'done' }));
        return urls[0];
      })
      .catch(() => {
        if (!entry.cancelled) setUploadStates(prev => ({ ...prev, [index]: 'error' }));
        return null;
      });
    bgUploads.current.set(index, entry);
  };

  const handleNewFiles = (files: { index: number; file: File }[]) => {
    if (qrNameValid && qrName) {
      files.forEach(({ index, file }) => startUpload(index, file, qrName));
    } else {
      // Queue until qrName is validated
      pendingFiles.current.push(...files);
    }
  };

  // Flush queued uploads once qrName becomes valid
  useEffect(() => {
    if (!qrNameValid || !qrName) return;
    const queued = pendingFiles.current.splice(0);
    queued.forEach(({ index, file }) => startUpload(index, file, qrName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrNameValid, qrName]);

  const handleFileRemoved = (index: number) => {
    const entry = bgUploads.current.get(index);
    if (entry) {
      entry.cancelled = true;
      bgUploads.current.delete(index);
    }
    pendingFiles.current = pendingFiles.current.filter(f => f.index !== index);
    setUploadStates(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateImageSegment = (start: number, length: number, segment: (File | null)[]) => {
    const next = [...uploadedImages];
    for (let i = 0; i < length; i++) {
      next[start + i] = segment[i] ?? null;
    }
    onImagesChangeSafe(next);
  };

  const updatePreviewSegment = (start: number, length: number, segment: string[]) => {
    const next = [...imagePreviews];
    for (let i = 0; i < length; i++) {
      next[start + i] = segment[i] ?? '';
    }
    setImagePreviews(next);
  };

  const onImagesChangeSafe = (next: (File | null)[]) => {
    setUploadedImages(next);
  };

  const segmentStates = (start: number, length: number): Record<number, 'uploading' | 'done' | 'error'> => {
    const out: Record<number, 'uploading' | 'done' | 'error'> = {};
    for (let i = 0; i < length; i++) {
      const st = uploadStates[start + i];
      if (st) out[i] = st;
    }
    return out;
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu đã nhập?')) {
      setSelectedTemplate(null);
      setQrName('');
      setQrNameValid(false);
      setQrUrl('');
      setContent('');
      setMusicAdded(false);
      setMusicLink('');
      setKeychainPurchased(false);
      setSelectedTip(null);
      setCustomTipAmount(0);
      setVoucher(null);
      setLetterTitle('Love Letter');
      setLetterSender('');
      setLetterReceiver('');
      setLoveDaysDate('');
      setLoveDaysNameFrom('');
      setLoveDaysNameTo('');
      setLoveDaysMessage('');
      setLoveDaysTimeline([{ date: '', text: '' }]);
      setBirthdayTitle('Happy Birthday');
      setBirthdayName('');
      setBirthdayAge('');
      setBirthdayDate('');
      setBirthdayFinalText('');
      setBirthdayBackgroundText('I LOVE YOU');
      setError('');
      setUploadedImages([]);
      setImagePreviews([]);
      bgUploads.current.forEach(entry => { entry.cancelled = true; });
      bgUploads.current.clear();
      pendingFiles.current = [];
      setUploadStates({});
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedTemplate) { setError('Vui lòng chọn template'); return; }
    if (!qrName || !qrNameValid) { setError('Vui lòng nhập và kiểm tra tên QR hợp lệ'); return; }
    if (templateType !== 'letterinspace' && templateType !== 'lovedays' && templateType !== 'birthday' && templateType !== 'galaxy' && !content.trim()) { setError('Vui lòng nhập nội dung'); return; }
    if (templateType === 'birthday' && birthdayFinalText.length > 50) {
      setError('Lời chúc không được quá 50 ký tự'); return;
    }
    if (musicAdded && !musicLink) { setError('Vui lòng xác nhận link nhạc trước khi thanh toán'); return; }

    setSubmitting(true);
    try {
      // Collect image URLs: await any still-in-progress background uploads
      const realFiles = uploadedImages.filter(Boolean) as File[];
      let imageUrls: string[] = [];
      if (realFiles.length > 0) {
        const urlResults = await Promise.all(
          uploadedImages.map((file, index) => {
            if (!file) return Promise.resolve(null);
            const entry = bgUploads.current.get(index);
            if (entry) return entry.promise;
            // Fallback: file present but no bg upload entry (e.g. restored from draft)
            return uploadFiles([file]).then(urls => urls[0]).catch(() => null);
          })
        );
        imageUrls = urlResults.filter((u): u is string => !!u);
        // If any uploads failed, abort
        if (imageUrls.length < realFiles.length) {
          setError('Một số ảnh upload thất bại, vui lòng thử lại');
          setSubmitting(false);
          return;
        }
      }

      const tipAmount = selectedTip === 'custom' ? customTipAmount : (selectedTip || 0);
      const parsedTimeline = loveDaysTimeline
        .map(item => ({ date: item.date.trim(), text: item.text.trim() }))
        .filter(item => item.date || item.text);

      const response = await createOrder({
        qrName,
        content: content.trim(),
        templateId: selectedTemplate.id,
        templateType,
        imageUrls,
        musicUrl: musicLink || undefined,
        musicAdded,
        keychainPurchased,
        tipAmount,
        voucherCode: voucher?.code,
        ...(templateType === 'loveletter' && {
          letterTitle: letterTitle || 'Love Letter',
          letterHint: letterHint.trim() || undefined,
          letterSignoff: letterSignoff.trim() || undefined,
          letterSender,
          letterReceiver,
        }),
        ...(templateType === 'lovedays' && {
          loveDaysDate,
          loveDaysNameFrom,
          loveDaysNameTo,
          loveDaysAvatarFrom: imageUrls[0] || '',
          loveDaysAvatarTo:   imageUrls[1] || '',
          loveDaysGalleryImages: imageUrls.slice(2),
          loveDaysMessage,
          loveDaysTimeline: parsedTimeline,
        }),
        ...(templateType === 'birthday' && {
          birthdayTitle,
          birthdayName,
          birthdayAge,
          birthdayDate,
          birthdayFinalText,
          birthdayBackgroundText,
        }),
      });

      if (response.success) {
        try {
          sessionStorage.setItem('orderFormDraft', JSON.stringify({
            selectedTemplate, qrName, qrNameValid, qrUrl, content,
            musicAdded, musicLink, keychainPurchased, selectedTip,
            customTipAmount, voucher,
            // Skip imagePreviews — base64 images can exceed iOS sessionStorage quota
          }));
        } catch { /* ignore quota errors — back-nav draft is optional */ }
        navigate(`/payment/${response.qrCode.qrName}`);
      } else {
        setError(response.error || 'Đặt hàng thất bại');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotal();

  // ── Order form ──────────────────────────────────────────────────────────────
  const orderFormTop = (
    <>
      <QrNameInput
        value={qrName}
        onChange={setQrName}
        onValidation={handleQrNameValidation}
      />

      {qrNameValid && qrUrl && (
        <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem', color: '#f05448', fontWeight: 600 }}>
          URL của bạn: <span style={{ textDecoration: 'underline' }}>{qrUrl}</span>
        </div>
      )}

      {templateType === 'letterinspace' && (
        <LetterInSpaceForm value={content} onChange={setContent} />
      )}

      {templateType !== 'letterinspace' && templateType !== 'lovedays' && templateType !== 'birthday' && templateType !== 'galaxy' && (
        <ContentEditor value={content} onChange={setContent} />
      )}

      {templateType === 'loveletter' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tiêu đề</label>
            <input
              type="text"
              value={letterTitle}
              onChange={e => setLetterTitle(e.target.value)}
              placeholder="Love Letter"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>
              Lời mời mở thư <span style={{ fontWeight: 400, color: '#6b7280' }}>(hiện trên lá thư khi chưa mở)</span>
            </label>
            <input
              type="text"
              value={letterHint}
              onChange={e => setLetterHint(e.target.value)}
              placeholder="Em iu ấn vào lá thư đi nè ❤"
              maxLength={80}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>
              Lời kết <span style={{ fontWeight: 400, color: '#6b7280' }}>(hiện trên dòng ký tên)</span>
            </label>
            <input
              type="text"
              value={letterSignoff}
              onChange={e => setLetterSignoff(e.target.value)}
              placeholder="Thương em rất nhiều. 💗"
              maxLength={80}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Người gửi</label>
            <input
              type="text"
              value={letterSender}
              onChange={e => setLetterSender(e.target.value)}
              placeholder="Sender Name"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Người nhận</label>
            <input
              type="text"
              value={letterReceiver}
              onChange={e => setLetterReceiver(e.target.value)}
              placeholder="Receiver Name"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {templateType === 'birthday' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Chữ nền background ✨</label>
            <input
              type="text"
              value={birthdayBackgroundText}
              onChange={e => setBirthdayBackgroundText(e.target.value)}
              placeholder="Ví dụ: I LOVE YOU"
              maxLength={20}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tiêu đề 🎉</label>
            <input
              type="text"
              value={birthdayTitle}
              onChange={e => setBirthdayTitle(e.target.value)}
              placeholder="Ví dụ: Happy Birthday"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên người được chúc 🎂</label>
            <input
              type="text"
              value={birthdayName}
              onChange={e => setBirthdayName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Thị Lan"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tuổi 🎈</label>
              <input
                type="text"
                value={birthdayAge}
                onChange={e => setBirthdayAge(e.target.value)}
                placeholder="Ví dụ: 22"
                maxLength={10}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Ngày sinh nhật 📅</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <select
                  value={birthdayDay}
                  onChange={e => {
                    const day = e.target.value;
                    const month = birthdayMonth;
                    if (!day && !month) { setBirthdayDate(''); return; }
                    setBirthdayDate(day ? (month ? `${day}.${month}` : `${day}.`) : `.${month}`);
                  }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">Ngày</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={birthdayMonth}
                  onChange={e => {
                    const month = e.target.value;
                    const day = birthdayDay;
                    if (!day && !month) { setBirthdayDate(''); return; }
                    setBirthdayDate(day ? (month ? `${day}.${month}` : `${day}.`) : `.${month}`);
                  }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">Tháng</option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>Chọn ngày và tháng (không cần năm)</p>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Lời chúc ❤️</label>
            <textarea
              value={birthdayFinalText}
              onChange={e => {
                const val = e.target.value;
                if (val.length <= 50) {
                  setBirthdayFinalText(val);
                }
              }}
              placeholder="Ví dụ: Chúc em tuổi mới hạnh phúc bên anh nha"
              rows={2}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: birthdayFinalText.length >= 50 ? '#ef4444' : '#6b7280', textAlign: 'right' }}>
              {birthdayFinalText.length}/50
            </p>
          </div>
        </div>
      )}

      {templateType === 'lovedays' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Ngày bắt đầu yêu nhau 💕</label>
            <input
              type="date"
              value={loveDaysDate}
              onChange={e => setLoveDaysDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên người 1</label>
              <input
                type="text"
                value={loveDaysNameFrom}
                onChange={e => setLoveDaysNameFrom(e.target.value)}
                placeholder="Ví dụ: Lan Anh"
                maxLength={30}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên người 2</label>
              <input
                type="text"
                value={loveDaysNameTo}
                onChange={e => setLoveDaysNameTo(e.target.value)}
                placeholder="Ví dụ: Minh Khôi"
                maxLength={30}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>
              Tin nhắn bí mật 🔒
              <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                (hiện ra khi trái tim đầy)
              </span>
            </label>
            <textarea
              value={loveDaysMessage}
              onChange={e => setLoveDaysMessage(e.target.value)}
              placeholder="Viết gì đó thật ngọt ngào..."
              maxLength={500}
              rows={4}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem' }}>
              Timeline kỷ niệm
              <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                (mỗi timeline là một dòng)
              </span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {loveDaysTimeline.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={row.date}
                    onChange={e => setLoveDaysTimeline(prev => prev.map((it, i) => i === idx ? { ...it, date: e.target.value } : it))}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    value={row.text}
                    onChange={e => setLoveDaysTimeline(prev => prev.map((it, i) => i === idx ? { ...it, text: e.target.value } : it))}
                    placeholder="Nhập nội dung timeline..."
                    maxLength={120}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setLoveDaysTimeline(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))}
                    style={{
                      padding: '0.4rem 0.65rem',
                      border: '1px solid #fecaca',
                      background: '#fff1f2',
                      color: '#be123c',
                      borderRadius: '0.45rem',
                      cursor: loveDaysTimeline.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: loveDaysTimeline.length <= 1 ? 0.5 : 1,
                    }}
                    disabled={loveDaysTimeline.length <= 1}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLoveDaysTimeline(prev => [...prev, { date: '', text: '' }])}
              style={{
                marginTop: '0.6rem',
                padding: '0.5rem 0.85rem',
                border: '1px solid #fda4af',
                background: '#fff1f2',
                color: '#be123c',
                borderRadius: '0.55rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Thêm timeline
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '-0.25rem' }}>
            Ảnh 1 = avatar người 1, ảnh 2 = avatar người 2, các ảnh còn lại dùng cho slider popup.
          </p>
        </div>
      )}
    </>
  );

  const orderFormBottom = (
    <>
      {templateType !== 'letterinspace' && templateType !== 'birthday' && (
        <>
          {templateType === 'lovedays' ? (
            <>
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                Ảnh đại diện 💑
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (ảnh 1 = người 1, ảnh 2 = người 2)
                </span>
              </p>
              <ImageUploader
                images={uploadedImages.slice(0, AVATAR_SLOTS)}
                onImagesChange={(segment) => updateImageSegment(0, AVATAR_SLOTS, segment)}
                maxImages={AVATAR_SLOTS}
                onImageSelected={() => {}}
                initialPreviews={imagePreviews.slice(0, AVATAR_SLOTS)}
                onPreviewsChange={(segment) => updatePreviewSegment(0, AVATAR_SLOTS, segment)}
                onNewFiles={(files) => handleNewFiles(files.map(f => ({ ...f, index: f.index })))}
                onFileRemoved={(index) => handleFileRemoved(index)}
                uploadStates={segmentStates(0, AVATAR_SLOTS)}
              />

              <p style={{ fontWeight: 500, margin: '0.85rem 0 0.25rem' }}>
                Ảnh slider popup 🖼️
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (tối đa {GALLERY_SLOTS} ảnh)
                </span>
              </p>
              <ImageUploader
                images={uploadedImages.slice(AVATAR_SLOTS, LOVEDAYS_MAX_IMAGES)}
                onImagesChange={(segment) => updateImageSegment(AVATAR_SLOTS, GALLERY_SLOTS, segment)}
                maxImages={GALLERY_SLOTS}
                onImageSelected={() => {}}
                initialPreviews={imagePreviews.slice(AVATAR_SLOTS, LOVEDAYS_MAX_IMAGES)}
                onPreviewsChange={(segment) => updatePreviewSegment(AVATAR_SLOTS, GALLERY_SLOTS, segment)}
                onNewFiles={(files) => handleNewFiles(files.map(f => ({ ...f, index: f.index + AVATAR_SLOTS })))}
                onFileRemoved={(index) => handleFileRemoved(index + AVATAR_SLOTS)}
                uploadStates={segmentStates(AVATAR_SLOTS, GALLERY_SLOTS)}
              />
            </>
          ) : (
            <ImageUploader
              images={uploadedImages}
              onImagesChange={setUploadedImages}
              maxImages={9}
              onImageSelected={() => {}}
              initialPreviews={imagePreviews}
              onPreviewsChange={setImagePreviews}
              onNewFiles={handleNewFiles}
              onFileRemoved={handleFileRemoved}
              uploadStates={uploadStates}
            />
          )}
        </>
      )}

      <MusicOption
        musicAdded={musicAdded}
        onMusicToggle={setMusicAdded}
        musicLink={musicLink}
        onMusicLinkChange={setMusicLink}
        qrName={qrName}
        musicPrice={musicPrice}
      />

      <div className="keychain-option">
        <label>
          <input
            type="checkbox"
            checked={keychainPurchased}
            onChange={(e) => setKeychainPurchased(e.target.checked)}
          />
          Mua móc khóa quét QR <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>+{keychainPrice.toLocaleString('en')}đ</span>
        </label>
      </div>

      <TipSelector
        selectedTip={selectedTip}
        onSelectTip={setSelectedTip}
        customAmount={customTipAmount}
        onCustomAmountChange={setCustomTipAmount}
      />

      <VoucherInput onVoucherValidated={handleVoucherValidated} />

      <div className="payment-section">
        {!qrNameValid && (
          <div className="qr-name-reminder">
            <span className="qr-name-reminder-arrow">↑</span>
            <span>Nhập tên QR trước nhé!</span>
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedTemplate || !qrNameValid}
          className="payment-button"
        >
          {submitting
            ? 'Đang xử lý...'
            : `Thanh toán (${totals.total >= 1000 ? `${Math.round(totals.total / 1000)}k` : `${totals.total}đ`})`}
        </button>

        {totals.discount > 0 && (
          <div className="price-breakdown">
            <div className="price-line">
              <span>Giá gốc:</span>
              <span>{totals.subtotal.toLocaleString('en')}đ</span>
            </div>
            <div className="price-line discount">
              <span>Giảm giá:</span>
              <span>-{totals.discount.toLocaleString('en')}đ</span>
            </div>
            <div className="price-line total">
              <span>Tổng cộng:</span>
              <span>{totals.total.toLocaleString('en')}đ</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Two-column product detail layout (preselected from homepage)
  if (preselectedTemplateId) {
    return (
      <div className="app">
        <div className="app-container app-container--wide">
          <Link to="/" className="back-link">&larr; Quay lại</Link>

          {selectedTemplate && (
            <>
              <div className="order-detail-layout">
                <div className="order-detail-left">
                  <img
                    className="order-detail-img"
                    src={selectedTemplate.image_url ? `${API_BASE_URL}${selectedTemplate.image_url}` : '/placeholder.png'}
                    alt={selectedTemplate.name}
                  />
                </div>
                <div className="order-detail-right">
                  <h1 className="order-detail-name">{selectedTemplate.name}</h1>
                  <div className="order-detail-price">{Math.round(selectedTemplate.price).toLocaleString('en')}đ</div>
                  {orderFormTop}
                </div>
              </div>
              {orderFormBottom}
            </>
          )}
        </div>
      </div>
    );
  }

  // Classic single-column layout (no preselection)
  return (
    <div className="app">
      <div className="app-container">
        <Link to="/" className="back-link">&larr; Quay lại</Link>
        <h1 className="app-title">Inanhxink</h1>

        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          onClearAll={handleClearAll}
        />

        {orderFormTop}
        {orderFormBottom}
      </div>
    </div>
  );
}

export default OrderPage;
