import { useState, useEffect } from 'react';
import './ContentEditor.css';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  note?: string;
}

function ContentEditor({ value, onChange, label, placeholder, note }: ContentEditorProps) {
  const [content, setContent] = useState(value || '');
  const maxLines = 11;
  const maxCharsPerLine = 7;
  const labelText = label || `Nội dung (tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ)`;
  const placeholderText = placeholder || `Nhập mỗi dòng một câu (tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ)`;
  const noteText = note || `Lưu ý: Tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ`;

  useEffect(() => {
    if (value !== undefined) {
      setContent(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
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
        className="content-textarea"
      />
      <p className="content-editor-note">
        {noteText}
      </p>
    </div>
  );
}

export default ContentEditor;

