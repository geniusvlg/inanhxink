import { useState, useEffect } from 'react';
import './ContentEditor.css';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  note?: string;
  maxLength?: number;
}

function ContentEditor({ value, onChange, label, placeholder, note, maxLength }: ContentEditorProps) {
  const [content, setContent] = useState(value || '');
  const maxLines = 11;
  const maxCharsPerLine = 7;
  const labelText = label || `Nội dung (tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ)`;
  const placeholderText = placeholder || `Nhập mỗi dòng một câu (tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ)`;
  const noteText = note || (maxLength !== undefined
    ? `${content.length}/${maxLength} ký tự`
    : `Lưu ý: Tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ`);
  const atLimit = maxLength !== undefined && content.length >= maxLength;

  useEffect(() => {
    if (value !== undefined) {
      setContent(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength !== undefined && newValue.length > maxLength) return;
    setContent(newValue);
    onChange(newValue);
  };

  const lines = content.split('\n');
  const lineCount = lines.length;
  const totalChars = content.length;

  return (
    <div className="content-editor">
      <label>
        {labelText}
      </label>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder={placeholderText}
        rows={4}
        maxLength={maxLength}
        className="content-textarea"
      />
      <p className={`content-editor-note${atLimit ? ' content-editor-note--limit' : ''}`}>
        {noteText}
      </p>
    </div>
  );
}

export default ContentEditor;

