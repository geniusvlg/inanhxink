import { useEffect, useMemo, useRef, useState } from 'react';
import './VoiceRecordingOption.css';

const MAX_RECORDING_SECONDS = 30;

export interface VoiceRecording {
  file: File;
  durationSeconds: number;
}

interface VoiceRecordingOptionProps {
  added: boolean;
  onToggle: (added: boolean) => void;
  recording: VoiceRecording | null;
  onRecordingChange: (recording: VoiceRecording | null) => void;
  onRecordingStart?: () => void;
  onRecordingStateChange?: (active: boolean) => void;
  price: number;
}

function supportedAudioType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionForType(type: string): string {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

export default function VoiceRecordingOption({
  added,
  onToggle,
  recording,
  onRecordingChange,
  onRecordingStart,
  onRecordingStateChange,
  price,
}: VoiceRecordingOptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrl = useMemo(
    () => recording ? URL.createObjectURL(recording.file) : '',
    [recording],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt này không hỗ trợ ghi âm. Vui lòng dùng Safari hoặc Chrome phiên bản mới.');
      return;
    }

    const mimeType = supportedAudioType();
    if (!mimeType) {
      setError('Thiết bị này không có định dạng ghi âm được hỗ trợ.');
      return;
    }

    try {
      onRecordingStart?.();
      document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        try { audio.currentTime = 0; } catch { /* ignore */ }
      });
      onRecordingStateChange?.(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);

      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        onRecordingStateChange?.(false);

        const durationSeconds = Math.min(
          MAX_RECORDING_SECONDS,
          Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        );
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setError('Không thu được âm thanh. Vui lòng thử lại.');
          return;
        }
        const file = new File(
          [blob],
          `voice-recording-${Date.now()}.${extensionForType(mimeType)}`,
          { type: mimeType },
        );
        onRecordingChange({ file, durationSeconds });
      });
      recorder.addEventListener('error', () => {
        setError('Ghi âm bị gián đoạn. Vui lòng thử lại.');
        stopRecording();
      });

      // No timeslice here on purpose: Safari's MediaRecorder for `audio/mp4`
      // writes each `dataavailable` chunk as a separate MP4 fragment, and the
      // *first* fragment's duration/moov metadata doesn't account for later
      // ones. Concatenating those chunks (as we do below) then produces an
      // .m4a whose declared duration is too short, so some players — notably
      // iOS Safari itself when replaying the finished recording — stop
      // playback near that (wrong, truncated) point instead of the real end.
      // Requesting a single, complete blob at `stop()` avoids the bug.
      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.min(
          MAX_RECORDING_SECONDS,
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        ));
      }, 250);
      stopTimerRef.current = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      onRecordingStateChange?.(false);
      const permissionDenied = err instanceof DOMException
        && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setError(permissionDenied
        ? 'Bạn cần cho phép truy cập micro để ghi âm.'
        : 'Không thể mở micro. Vui lòng kiểm tra thiết bị và thử lại.');
    }
  };

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      stopRecording();
      onRecordingChange(null);
      onRecordingStateChange?.(false);
      setError('');
    }
    onToggle(checked);
  };

  return (
    <div className="voice-recording-option">
      <label className="voice-recording-checkbox">
        <input
          type="checkbox"
          checked={added}
          onChange={event => handleToggle(event.target.checked)}
        />
        <span>Thêm lời nhắn bằng giọng nói</span>
        <span className="voice-recording-price">+{price.toLocaleString('vi-VN')}đ</span>
      </label>

      {added && (
        <div className="voice-recording-panel">
          <p className="voice-recording-hint">
            Ghi tối đa {MAX_RECORDING_SECONDS} giây. Tắt nhạc nền khi ghi — nghe lại bản mix bên dưới sau khi xong.
          </p>

          {isRecording ? (
            <div className="voice-recording-active">
              <span className="voice-recording-dot" aria-hidden="true" />
              <strong>Đang ghi {elapsedSeconds}/{MAX_RECORDING_SECONDS} giây</strong>
              <button type="button" className="voice-recording-stop" onClick={stopRecording}>
                Dừng ghi
              </button>
            </div>
          ) : recording ? (
            <div className="voice-recording-preview">
              <audio controls preload="metadata" src={previewUrl}>
                Trình duyệt của bạn không hỗ trợ phát âm thanh.
              </audio>
              <div className="voice-recording-actions">
                <span>{recording.durationSeconds} giây</span>
                <button type="button" onClick={startRecording}>Ghi lại</button>
                <button type="button" onClick={() => onRecordingChange(null)}>Xóa</button>
              </div>
            </div>
          ) : (
            <button type="button" className="voice-recording-start" onClick={startRecording}>
              Bắt đầu ghi âm
            </button>
          )}

          {error && <p className="voice-recording-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
