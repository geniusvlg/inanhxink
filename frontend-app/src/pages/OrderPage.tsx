import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import '../App.css';
import SiteHeader from '../components/SiteHeader';
import TemplateSelector from '../components/TemplateSelector';
import QrNameInput from '../components/QrNameInput';
import ContentEditor from '../components/ContentEditor';
import LetterInSpaceForm from '../components/LetterInSpaceForm';
import MusicOption from '../components/MusicOption';
import VoiceRecordingOption, { type VoiceRecording } from '../components/VoiceRecordingOption';
import TipSelector from '../components/TipSelector';
import VoucherInput from '../components/VoucherInput';
import ImageUploader from '../components/ImageUploader';
import FarewellStagesEditor from '../components/FarewellStagesEditor';
import { type Template } from '../data/mockTemplates';
import { createOrder, uploadFiles, uploadVoiceRecording, getTemplate, getMetadata } from '../services/api';
import { resolveAssetUrl } from '../utils/assetUrl';

const CONTENT_OPTIONAL_TEMPLATE_TYPES = new Set(['letterinspace', 'lovedays', 'birthday', 'birthdaycake', 'galaxy', 'farewell']);

const FAREWELL_DESTINATIONS = [
  ['australia', 'Úc'],
  ['usa', 'Hoa Kỳ'],
  ['canada', 'Canada'],
  ['uk', 'Anh'],
  ['france', 'Pháp'],
  ['germany', 'Đức'],
  ['japan', 'Nhật Bản'],
  ['korea', 'Hàn Quốc'],
  ['singapore', 'Singapore'],
  ['newzealand', 'New Zealand'],
  ['netherlands', 'Hà Lan'],
  ['other', 'Quốc gia khác'],
] as const;
const HIDE_IMAGE_UPLOADER_TEMPLATE_TYPES = new Set(['letterinspace', 'birthday', 'farewell']);
const DEFAULT_FAREWELL_STAGE_COUNT = 5;
const MAX_FAREWELL_STAGES = 8;
const DEFAULT_LOVEBURST_MESSAGES = ['Gửi Em 💖💕', 'Người Anh Yêu Nhất 💝', 'Mãi Bên Em 💖', ''];

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
  const [voiceRecordingAdded, setVoiceRecordingAdded] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState<VoiceRecording | null>(null);
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
  // Special Gift fields
  const [specialGiftDate, setSpecialGiftDate] = useState('');
  const [specialGiftNameLeft, setSpecialGiftNameLeft] = useState('');
  const [specialGiftNameRight, setSpecialGiftNameRight] = useState('');
  const [specialGiftDayLabel, setSpecialGiftDayLabel] = useState('ngày yêu nhau');
  const [specialGiftTitle, setSpecialGiftTitle] = useState("Happy Valentine's Day 💘");
  // Birthday fields
  const [birthdayTitle, setBirthdayTitle] = useState('Happy Birthday');
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayAge, setBirthdayAge] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [birthdayDay = '', birthdayMonth = ''] = birthdayDate.split('.');
  const [birthdayFinalText, setBirthdayFinalText] = useState('');
  const [birthdayBackgroundText, setBirthdayBackgroundText] = useState('I LOVE YOU');
  // Birthday Cake fields
  const [birthdayCakeLetterTitle, setBirthdayCakeLetterTitle] = useState('Gửi công chúa nhỏ của anh ❤️');
  const [birthdayCakeLetterBody, setBirthdayCakeLetterBody] = useState('');
  const [birthdayCakeInscription, setBirthdayCakeInscription] = useState('');
  // Farewell fields
  const [farewellFriendName, setFarewellFriendName] = useState('');
  const [farewellFrom, setFarewellFrom] = useState('Việt Nam');
  const [farewellDestination, setFarewellDestination] = useState('australia');
  const [farewellDepartureDate, setFarewellDepartureDate] = useState('');
  const [farewellMessage, setFarewellMessage] = useState('');
  const [farewellSender, setFarewellSender] = useState('');
  // Each stage owns three consecutive upload slots; messages are stage-indexed.
  const [farewellStageCount, setFarewellStageCount] = useState(DEFAULT_FAREWELL_STAGE_COUNT);
  const [farewellStageMessages, setFarewellStageMessages] = useState<string[]>([]);
  const [loveburstTitle, setLoveburstTitle] = useState('Gửi bé iu 💖');
  const [loveburstMessages, setLoveburstMessages] = useState<string[]>(DEFAULT_LOVEBURST_MESSAGES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadedImages, setUploadedImages] = useState<(File | null)[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [musicPrice, setMusicPrice] = useState(10000);
  const [voiceRecordingPrice, setVoiceRecordingPrice] = useState(10000);
  const [keychainPrice, setKeychainPrice] = useState(35000);
  const [keychainEnabled, setKeychainEnabled] = useState(true);

  // Background upload tracking: slot index → { promise, cancelled }
  const bgUploads = useRef<Map<number, { promise: Promise<string | null>; cancelled: boolean }>>(new Map());
  const [uploadStates, setUploadStates] = useState<Record<number, 'uploading' | 'done' | 'error'>>({});

  const templateType = selectedTemplate?.template_type || '';
  const canUploadImages = qrNameValid && Boolean(qrName);
  const uploadDisabledReason = 'Vui lòng nhập và kiểm tra tên QR trước khi tải ảnh lên.';
  const AVATAR_SLOTS = 2;
  const GALLERY_SLOTS = 10;
  const QR_TEMPLATE_MAX_IMAGES = 12;
  const LOVELETTER_MAX_IMAGES = 15;
  const GALAXY_MAX_IMAGES = 15;
  const BIRTHDAY_CAKE_MAX_IMAGES = 24;
  const LOVEDAYS_MAX_IMAGES = AVATAR_SLOTS + GALLERY_SLOTS;
  const SPECIAL_GIFT_AVATAR_SLOTS = 2;
  const SPECIAL_GIFT_GALLERY_SLOTS = QR_TEMPLATE_MAX_IMAGES;
  const SPECIAL_GIFT_MAX_IMAGES = SPECIAL_GIFT_AVATAR_SLOTS + SPECIAL_GIFT_GALLERY_SLOTS;

  const preselectedTemplateId = searchParams.get('template');

  // Fetch prices from metadata
  useEffect(() => {
    getMetadata().then(data => {
      if (data.music_price) setMusicPrice(parseInt(data.music_price));
      if (data.voice_recording_price) setVoiceRecordingPrice(parseInt(data.voice_recording_price));
      if (data.keychain_price) setKeychainPrice(parseInt(data.keychain_price));
      if (data.keychain_enabled === 'false') {
        setKeychainEnabled(false);
        setKeychainPurchased(false);
      }
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
        if (d.specialGiftDate) setSpecialGiftDate(d.specialGiftDate);
        if (d.specialGiftNameLeft) setSpecialGiftNameLeft(d.specialGiftNameLeft);
        if (d.specialGiftNameRight) setSpecialGiftNameRight(d.specialGiftNameRight);
        if (d.specialGiftDayLabel) setSpecialGiftDayLabel(d.specialGiftDayLabel);
        if (d.specialGiftTitle) setSpecialGiftTitle(d.specialGiftTitle);
        if (d.birthdayCakeLetterTitle) setBirthdayCakeLetterTitle(d.birthdayCakeLetterTitle);
        if (d.birthdayCakeLetterBody) setBirthdayCakeLetterBody(d.birthdayCakeLetterBody);
        if (d.birthdayCakeInscription) setBirthdayCakeInscription(d.birthdayCakeInscription);
        if (d.farewellFriendName) setFarewellFriendName(d.farewellFriendName);
        if (d.farewellFrom) setFarewellFrom(d.farewellFrom);
        if (d.farewellDestination) setFarewellDestination(d.farewellDestination);
        if (d.farewellDepartureDate) setFarewellDepartureDate(d.farewellDepartureDate);
        if (d.farewellMessage) setFarewellMessage(d.farewellMessage);
        if (d.farewellSender) setFarewellSender(d.farewellSender);
        if (d.farewellStageCount) {
          setFarewellStageCount(Math.min(MAX_FAREWELL_STAGES, Math.max(1, Number(d.farewellStageCount))));
        }
        if (d.farewellStageMessages?.length) {
          setFarewellStageMessages(d.farewellStageMessages);
        } else if (d.farewellCaptions?.length) {
          // Backward-compatible draft restore from the old photo-caption model.
          setFarewellStageMessages(d.farewellCaptions);
        }
        if (d.loveburstTitle) setLoveburstTitle(d.loveburstTitle);
        if (Array.isArray(d.loveburstMessages)) {
          setLoveburstMessages(
            Array.from({ length: 4 }, (_, i) => String(d.loveburstMessages[i] || '')),
          );
        } else if (typeof d.loveburstMessages === 'string') {
          const restoredMessages = d.loveburstMessages.split('\n');
          setLoveburstMessages(
            Array.from({ length: 4 }, (_, i) => restoredMessages[i] || ''),
          );
        }
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
    if (voiceRecordingAdded) subtotal += voiceRecordingPrice;
    if (keychainEnabled && keychainPurchased) subtotal += keychainPrice;
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

  const resetImageUploads = () => {
    bgUploads.current.forEach(entry => { entry.cancelled = true; });
    bgUploads.current.clear();
    setUploadStates({});
    setUploadedImages([]);
    setImagePreviews([]);
  };

  const handleQrNameChange = (value: string) => {
    if (value !== qrName && (qrNameValid || uploadedImages.some(Boolean) || bgUploads.current.size > 0)) {
      resetImageUploads();
    }
    setQrName(value);
    setQrNameValid(false);
    setQrUrl('');
  };

  const handleQrNameValidation = (isValid: boolean, fullUrl?: string) => {
    setQrNameValid(isValid);
    setQrUrl(fullUrl || '');
  };

  const handleVoucherValidated = (voucherData: Voucher | null) => {
    setVoucher(voucherData);
  };

  const handleMusicToggle = (added: boolean) => {
    setMusicAdded(added);
    if (added) {
      setVoiceRecordingAdded(false);
      setVoiceRecording(null);
    }
  };

  const handleVoiceRecordingToggle = (added: boolean) => {
    setVoiceRecordingAdded(added);
    if (added) {
      setMusicAdded(false);
      setMusicLink('');
    }
  };

  const startUpload = (index: number, file: File, name: string) => {
    setUploadStates(prev => ({ ...prev, [index]: 'uploading' }));
    const entry: { promise: Promise<string | null>; cancelled: boolean } = { promise: null!, cancelled: false };
    const tryUpload = () => uploadFiles([file], name);
    entry.promise = tryUpload()
      .catch(() => tryUpload()) // auto-retry once silently
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

  const handleRetry = (index: number) => {
    const file = uploadedImages[index];
    if (!file || !qrName) return;
    startUpload(index, file, qrName);
  };;

  const handleNewFiles = (files: { index: number; file: File }[]) => {
    if (!canUploadImages) {
      setError('Vui lòng kiểm tra tên QR trước khi tải ảnh lên');
      return;
    }
    files.forEach(({ index, file }) => startUpload(index, file, qrName));
  };

  const handleFileRemoved = (index: number) => {
    const entry = bgUploads.current.get(index);
    if (entry) {
      entry.cancelled = true;
      bgUploads.current.delete(index);
    }
    setUploadStates(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleFarewellStageCountChange = (count: number) => {
    const nextCount = Math.min(MAX_FAREWELL_STAGES, Math.max(1, count));
    if (nextCount < farewellStageCount) {
      for (let slot = nextCount; slot < farewellStageCount; slot++) {
        handleFileRemoved(slot);
      }
      setUploadedImages(prev => prev.slice(0, nextCount));
      setImagePreviews(prev => prev.slice(0, nextCount));
      setFarewellStageMessages(prev => prev.slice(0, nextCount));
    }
    setFarewellStageCount(nextCount);
  };

  const handleFarewellStageImage = (index: number, file: File, preview: string) => {
    const previous = bgUploads.current.get(index);
    if (previous) {
      previous.cancelled = true;
      bgUploads.current.delete(index);
    }
    setUploadedImages(prev => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setImagePreviews(prev => {
      const next = [...prev];
      next[index] = preview;
      return next;
    });
    startUpload(index, file, qrName);
  };

  const handleFarewellStageImageRemoved = (index: number) => {
    handleFileRemoved(index);
    setUploadedImages(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setImagePreviews(prev => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  const handleFarewellStageMessage = (index: number, message: string) => {
    setFarewellStageMessages(prev => {
      const next = [...prev];
      next[index] = message;
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
      setVoiceRecordingAdded(false);
      setVoiceRecording(null);
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
      setSpecialGiftDate('');
      setSpecialGiftNameLeft('');
      setSpecialGiftNameRight('');
      setSpecialGiftDayLabel('ngày yêu nhau');
      setSpecialGiftTitle("Happy Valentine's Day 💘");
      setBirthdayTitle('Happy Birthday');
      setBirthdayName('');
      setBirthdayAge('');
      setBirthdayDate('');
      setBirthdayFinalText('');
      setBirthdayBackgroundText('I LOVE YOU');
      setBirthdayCakeLetterTitle('Gửi công chúa nhỏ của anh ❤️');
      setBirthdayCakeLetterBody('');
      setBirthdayCakeInscription('');
      setFarewellFriendName('');
      setFarewellFrom('Việt Nam');
      setFarewellDestination('australia');
      setFarewellDepartureDate('');
      setFarewellMessage('');
      setFarewellSender('');
      setFarewellStageCount(DEFAULT_FAREWELL_STAGE_COUNT);
      setFarewellStageMessages([]);
      setError('');
      setUploadedImages([]);
      setImagePreviews([]);
      resetImageUploads();
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedTemplate) { setError('Vui lòng chọn template'); return; }
    if (!qrName || !qrNameValid) { setError('Vui lòng nhập và kiểm tra tên QR hợp lệ'); return; }
    if (!CONTENT_OPTIONAL_TEMPLATE_TYPES.has(templateType) && !content.trim()) { setError('Vui lòng nhập nội dung'); return; }
    if (templateType === 'specialgift' && !specialGiftDate) {
      setError('Vui lòng chọn ngày bắt đầu');
      return;
    }
    if (templateType === 'loveburst') {
      const lines = loveburstMessages.map(s => s.trim()).filter(Boolean);
      if (!lines.length) { setError('Vui lòng nhập ít nhất một câu lời nhắn hạt sáng'); return; }
      if (lines.some(line => line.length > 40)) { setError('Mỗi câu lời nhắn tối đa 40 ký tự'); return; }
      if (content.length > 200) { setError('Nội dung thư không được quá 200 ký tự'); return; }
      if (!uploadedImages.some(Boolean)) { setError('Vui lòng tải lên ít nhất một ảnh'); return; }
    }
    if (templateType === 'specialgift' && content.length > 200) {
      setError('Nội dung thư không được quá 200 ký tự'); return;
    }
    if (templateType === 'birthday' && birthdayFinalText.length > 50) {
      setError('Lời chúc không được quá 50 ký tự'); return;
    }
    if (templateType === 'birthdaycake' && !birthdayCakeLetterBody.trim()) {
      setError('Vui lòng nhập nội dung thư sinh nhật');
      return;
    }
    if (templateType === 'birthdaycake' && !uploadedImages.some(Boolean)) {
      setError('Vui lòng tải ít nhất 1 ảnh cho Birthday Cake');
      return;
    }
    if (templateType === 'farewell' && !farewellFriendName.trim()) {
      setError('Vui lòng nhập tên người bạn sắp đi xa');
      return;
    }
    if (templateType === 'farewell' && !farewellMessage.trim()) {
      setError('Vui lòng nhập lời nhắn chia tay');
      return;
    }
    if (musicAdded && !musicLink) { setError('Vui lòng xác nhận link nhạc trước khi thanh toán'); return; }
    if (voiceRecordingAdded && !voiceRecording) { setError('Vui lòng ghi âm lời nhắn trước khi thanh toán'); return; }

    setSubmitting(true);
    try {
      // Collect image URLs: await any still-in-progress background uploads
      const submissionImages = templateType === 'farewell'
        ? uploadedImages.slice(0, farewellStageCount)
        : uploadedImages;
      const realFiles = submissionImages.filter(Boolean) as File[];
      let imageUrls: string[] = [];
      let imageUrlsBySlot: (string | null)[] = [];
      if (realFiles.length > 0) {
        const urlResults = await Promise.all(
          submissionImages.map((file, index) => {
            if (!file) return Promise.resolve(null);
            const entry = bgUploads.current.get(index);
            if (entry) return entry.promise;
            // Fallback for restored drafts: still upload into the verified QR folder.
            return uploadFiles([file], qrName).then(urls => urls[0]).catch(() => null);
          })
        );
        imageUrlsBySlot = urlResults;
        imageUrls = urlResults.filter((u): u is string => !!u);
        // If any uploads failed, abort
        if (imageUrls.length < realFiles.length) {
          setError('Một số ảnh upload thất bại, vui lòng thử lại');
          setSubmitting(false);
          return;
        }
      }

      let voiceRecordingUrl: string | undefined;
      if (voiceRecordingAdded && voiceRecording) {
        voiceRecordingUrl = await uploadVoiceRecording(voiceRecording.file, qrName);
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
        voiceRecordingAdded,
        voiceRecordingUrl,
        keychainPurchased: keychainEnabled && keychainPurchased,
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
        ...(templateType === 'specialgift' && {
          specialGiftDate,
          specialGiftNameLeft: specialGiftNameLeft.trim(),
          specialGiftNameRight: specialGiftNameRight.trim(),
          specialGiftDayLabel: specialGiftDayLabel.trim(),
          specialGiftTitle: specialGiftTitle.trim(),
          specialGiftAvatarLeft: imageUrls[0] || '',
          specialGiftAvatarRight: imageUrls[1] || '',
          specialGiftGalleryImages: imageUrls.slice(SPECIAL_GIFT_AVATAR_SLOTS),
        }),
        ...(templateType === 'birthday' && {
          birthdayTitle,
          birthdayName,
          birthdayAge,
          birthdayDate,
          birthdayFinalText,
          birthdayBackgroundText,
        }),
        ...(templateType === 'birthdaycake' && {
          birthdayCakeLetterTitle: birthdayCakeLetterTitle.trim(),
          birthdayCakeLetterBody: birthdayCakeLetterBody.trim(),
          birthdayCakeInscription: birthdayCakeInscription.trim(),
          birthdayCakeGiftLanguage: 'vi',
        }),
        ...(templateType === 'farewell' && {
          farewellFriendName: farewellFriendName.trim(),
          farewellFrom: farewellFrom.trim(),
          farewellDestination,
          farewellDepartureDate,
          farewellMessage: farewellMessage.trim(),
          farewellSender: farewellSender.trim(),
          farewellStages: Array.from({ length: farewellStageCount }, (_, index) => ({
            imageUrl: imageUrlsBySlot[index] || '',
            message: (farewellStageMessages[index] || '').trim(),
          })),
          // Keep the legacy arrays for existing readers and the final recap.
          farewellCaptions: submissionImages
            .map((file, i) => (file ? (farewellStageMessages[i] || '').trim() : null))
            .filter((caption): caption is string => caption !== null),
        }),
        ...(templateType === 'loveburst' && {
          loveburstTitle: loveburstTitle.trim() || 'Gửi bé iu 💖',
          loveburstMessages: loveburstMessages.map(s => s.trim()).filter(Boolean),
        }),
      });

      if (response.success) {
        try {
          sessionStorage.setItem('orderFormDraft', JSON.stringify({
            selectedTemplate, qrName, qrNameValid, qrUrl, content,
            musicAdded, musicLink, keychainPurchased, selectedTip,
            customTipAmount, voucher, specialGiftDate,
            specialGiftNameLeft, specialGiftNameRight, specialGiftDayLabel,
            specialGiftTitle, birthdayCakeLetterTitle, birthdayCakeLetterBody,
            birthdayCakeInscription,
            farewellFriendName, farewellFrom, farewellDestination,
            farewellDepartureDate, farewellMessage, farewellSender,
            farewellStageCount, farewellStageMessages,
            loveburstTitle, loveburstMessages,
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
        onChange={handleQrNameChange}
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

      {templateType === 'specialgift' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0 0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Ngày bắt đầu</label>
            <input
              type="date"
              value={specialGiftDate}
              onChange={e => setSpecialGiftDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Số ngày trên trái tim sẽ được tính từ ngày này đến hôm nay.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên bên trái</label>
              <input
                type="text"
                value={specialGiftNameLeft}
                onChange={e => setSpecialGiftNameLeft(e.target.value)}
                placeholder="Anh iu"
                maxLength={20}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên bên phải</label>
              <input
                type="text"
                value={specialGiftNameRight}
                onChange={e => setSpecialGiftNameRight(e.target.value)}
                placeholder="Bé iu"
                maxLength={20}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Dòng chữ dưới số ngày</label>
            <input
              type="text"
              value={specialGiftDayLabel}
              onChange={e => setSpecialGiftDayLabel(e.target.value)}
              placeholder="ngày yêu nhau"
              maxLength={30}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tiêu đề popup</label>
            <input
              type="text"
              value={specialGiftTitle}
              onChange={e => setSpecialGiftTitle(e.target.value)}
              placeholder="Happy Valentine's Day 💘"
              maxLength={50}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Viết nội dung bên dưới để hiển thị trong popup thư.
          </p>
        </div>
      )}

      {templateType === 'galaxy' && (
        <ContentEditor
          value={content}
          onChange={setContent}
          label="Lời nhắn trong phong thư"
          placeholder="Nhập lời nhắn sẽ hiện khi người xem mở phong thư..."
          maxLength={150}
        />
      )}

      {templateType === 'loveburst' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0 0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tiêu đề popup</label>
            <input
              type="text"
              value={loveburstTitle}
              onChange={e => setLoveburstTitle(e.target.value)}
              placeholder="Gửi bé iu 💖"
              maxLength={50}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Lời nhắn hạt sáng</label>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {loveburstMessages.map((message, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={message}
                    onChange={e => setLoveburstMessages(current => (
                      current.map((value, messageIndex) => (
                        messageIndex === index ? e.target.value : value
                      ))
                    ))}
                    placeholder={`Câu ${index + 1}${index === 0 ? ' (ví dụ: Gửi Em 💖)' : ' (không bắt buộc)'}`}
                    maxLength={40}
                    aria-label={`Lời nhắn hạt sáng ${index + 1}`}
                    style={{
                      width: '100%',
                      padding: '0.625rem 3.25rem 0.625rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                  }}>
                    {message.length}/40
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Tối đa 4 câu, mỗi câu 40 ký tự. Ô trống sẽ không hiển thị.
            </p>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Viết nội dung bên dưới để hiển thị trong popup thư.
          </p>
        </div>
      )}

      {!CONTENT_OPTIONAL_TEMPLATE_TYPES.has(templateType) && (
        <ContentEditor
          value={content}
          onChange={setContent}
          label={templateType === 'specialgift' || templateType === 'loveburst' ? 'Nội dung thư' : undefined}
          placeholder={templateType === 'specialgift' || templateType === 'loveburst' ? 'Nhập nội dung sẽ hiển thị trong popup thư...' : undefined}
          maxLength={templateType === 'specialgift' || templateType === 'loveburst' ? 200 : undefined}
        />
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

      {templateType === 'birthdaycake' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tiêu đề thư</label>
            <input
              type="text"
              value={birthdayCakeLetterTitle}
              onChange={e => setBirthdayCakeLetterTitle(e.target.value)}
              placeholder="Ví dụ: Gửi công chúa nhỏ của anh ❤️"
              maxLength={80}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Nội dung thư sinh nhật</label>
            <textarea
              value={birthdayCakeLetterBody}
              onChange={e => setBirthdayCakeLetterBody(e.target.value)}
              placeholder="Viết lời chúc sẽ hiện trong phong thư..."
              rows={5}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Chữ trên bánh</label>
            <textarea
              value={birthdayCakeInscription}
              onChange={e => setBirthdayCakeInscription(e.target.value)}
              placeholder={'Ví dụ: Bé Hương Giang\n21+'}
              rows={2}
              maxLength={60}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Các ảnh bên dưới sẽ dùng cho tường ảnh và bánh sinh nhật.
            </p>
          </div>
        </div>
      )}

      {templateType === 'farewell' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Tên người sắp đi xa</label>
            <input
              type="text"
              value={farewellFriendName}
              onChange={e => setFarewellFriendName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Thảo Vy"
              maxLength={40}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Khởi hành từ</label>
              <input
                type="text"
                value={farewellFrom}
                onChange={e => setFarewellFrom(e.target.value)}
                placeholder="Ví dụ: Hà Nội"
                maxLength={30}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Điểm đến</label>
              <select
                value={farewellDestination}
                onChange={e => setFarewellDestination(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#fff' }}
              >
                {FAREWELL_DESTINATIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Ngày bay</label>
            <input
              type="date"
              value={farewellDepartureDate}
              onChange={e => setFarewellDepartureDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Lời nhắn chia tay</label>
            <textarea
              value={farewellMessage}
              onChange={e => setFarewellMessage(e.target.value)}
              placeholder="Viết lời nhắn sẽ hiện ở cuối hành trình..."
              rows={5}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Ký tên</label>
            <input
              type="text"
              value={farewellSender}
              onChange={e => setFarewellSender(e.target.value)}
              placeholder="Ví dụ: Hội bạn thân luôn nhớ cậu"
              maxLength={60}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
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
      {!HIDE_IMAGE_UPLOADER_TEMPLATE_TYPES.has(templateType) && (
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
                onRetry={(index) => handleRetry(index)}
                uploadStates={segmentStates(0, AVATAR_SLOTS)}
                disabled={!canUploadImages}
                disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
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
                onRetry={(index) => handleRetry(index + AVATAR_SLOTS)}
                uploadStates={segmentStates(AVATAR_SLOTS, GALLERY_SLOTS)}
                disabled={!canUploadImages}
                disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
              />
            </>
          ) : templateType === 'specialgift' ? (
            <>
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                Ảnh đại diện
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (ảnh 1 = bên trái, ảnh 2 = bên phải)
                </span>
              </p>
              <ImageUploader
                images={uploadedImages.slice(0, SPECIAL_GIFT_AVATAR_SLOTS)}
                onImagesChange={(segment) => updateImageSegment(0, SPECIAL_GIFT_AVATAR_SLOTS, segment)}
                maxImages={SPECIAL_GIFT_AVATAR_SLOTS}
                onImageSelected={() => {}}
                initialPreviews={imagePreviews.slice(0, SPECIAL_GIFT_AVATAR_SLOTS)}
                onPreviewsChange={(segment) => updatePreviewSegment(0, SPECIAL_GIFT_AVATAR_SLOTS, segment)}
                onNewFiles={(files) => handleNewFiles(files.map(f => ({ ...f, index: f.index })))}
                onFileRemoved={(index) => handleFileRemoved(index)}
                onRetry={(index) => handleRetry(index)}
                uploadStates={segmentStates(0, SPECIAL_GIFT_AVATAR_SLOTS)}
                disabled={!canUploadImages}
                disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
              />

              <p style={{ fontWeight: 500, margin: '0.85rem 0 0.25rem' }}>
                Ảnh kỷ niệm
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (tối đa {SPECIAL_GIFT_GALLERY_SLOTS} ảnh)
                </span>
              </p>
              <ImageUploader
                images={uploadedImages.slice(SPECIAL_GIFT_AVATAR_SLOTS, SPECIAL_GIFT_MAX_IMAGES)}
                onImagesChange={(segment) => updateImageSegment(SPECIAL_GIFT_AVATAR_SLOTS, SPECIAL_GIFT_GALLERY_SLOTS, segment)}
                maxImages={SPECIAL_GIFT_GALLERY_SLOTS}
                onImageSelected={() => {}}
                initialPreviews={imagePreviews.slice(SPECIAL_GIFT_AVATAR_SLOTS, SPECIAL_GIFT_MAX_IMAGES)}
                onPreviewsChange={(segment) => updatePreviewSegment(SPECIAL_GIFT_AVATAR_SLOTS, SPECIAL_GIFT_GALLERY_SLOTS, segment)}
                onNewFiles={(files) => handleNewFiles(files.map(f => ({ ...f, index: f.index + SPECIAL_GIFT_AVATAR_SLOTS })))}
                onFileRemoved={(index) => handleFileRemoved(index + SPECIAL_GIFT_AVATAR_SLOTS)}
                onRetry={(index) => handleRetry(index + SPECIAL_GIFT_AVATAR_SLOTS)}
                uploadStates={segmentStates(SPECIAL_GIFT_AVATAR_SLOTS, SPECIAL_GIFT_GALLERY_SLOTS)}
                disabled={!canUploadImages}
                disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
              />
            </>
          ) : templateType === 'birthdaycake' ? (
            <>
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                Ảnh Birthday Cake
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (tối đa {BIRTHDAY_CAKE_MAX_IMAGES} ảnh)
                </span>
              </p>
              <ImageUploader
                images={uploadedImages}
                onImagesChange={setUploadedImages}
                maxImages={BIRTHDAY_CAKE_MAX_IMAGES}
                onImageSelected={() => {}}
                initialPreviews={imagePreviews}
                onPreviewsChange={setImagePreviews}
                onNewFiles={handleNewFiles}
                onFileRemoved={handleFileRemoved}
                onRetry={handleRetry}
                uploadStates={uploadStates}
                disabled={!canUploadImages}
                disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
              />
            </>
          ) : (
            <ImageUploader
              images={uploadedImages}
              onImagesChange={setUploadedImages}
              maxImages={
                templateType === 'galaxy'
                  ? GALAXY_MAX_IMAGES
                  : templateType === 'loveletter'
                  ? LOVELETTER_MAX_IMAGES
                  : QR_TEMPLATE_MAX_IMAGES
              }
              onImageSelected={() => {}}
              initialPreviews={imagePreviews}
              onPreviewsChange={setImagePreviews}
              onNewFiles={handleNewFiles}
              onFileRemoved={handleFileRemoved}
              onRetry={handleRetry}
              uploadStates={uploadStates}
              disabled={!canUploadImages}
              disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
            />
          )}

        </>
      )}

      {templateType === 'farewell' && (
        <FarewellStagesEditor
          stageCount={farewellStageCount}
          messages={farewellStageMessages}
          images={uploadedImages}
          previews={imagePreviews}
          uploadStates={uploadStates}
          disabled={!canUploadImages}
          disabledReason={!canUploadImages ? uploadDisabledReason : undefined}
          onStageCountChange={handleFarewellStageCountChange}
          onMessageChange={handleFarewellStageMessage}
          onImageSelected={handleFarewellStageImage}
          onImageRemoved={handleFarewellStageImageRemoved}
          onRetry={handleRetry}
        />
      )}

      <MusicOption
        musicAdded={musicAdded}
        onMusicToggle={handleMusicToggle}
        musicLink={musicLink}
        onMusicLinkChange={setMusicLink}
        qrName={qrName}
        musicPrice={musicPrice}
      />

      <VoiceRecordingOption
        added={voiceRecordingAdded}
        onToggle={handleVoiceRecordingToggle}
        recording={voiceRecording}
        onRecordingChange={setVoiceRecording}
        price={voiceRecordingPrice}
      />

      {keychainEnabled && (
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
      )}

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
      <>
        <SiteHeader />
        <div className="app">
          <div className="app-container app-container--wide">
            <Link to="/" className="back-link">&larr; Quay lại</Link>

            {selectedTemplate && (
              <>
                <div className="order-detail-layout">
                  <div className="order-detail-left">
                    <img
                      className="order-detail-img"
                      src={resolveAssetUrl(selectedTemplate.image_url)}
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
      </>
    );
  }

  // Classic single-column layout (no preselection)
  return (
    <>
      <SiteHeader />
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
    </>
  );
}

export default OrderPage;
