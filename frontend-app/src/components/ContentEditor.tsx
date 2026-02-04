import { useState, useEffect } from 'react';
import './ContentEditor.css';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function ContentEditor({ value, onChange }: ContentEditorProps) {
  const [content, setContent] = useState(value || '');
  const maxLines = 11;
  const maxCharsPerLine = 7;

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
        Nội dung (tối đa {maxLines} dòng, mỗi dòng tối đa {maxCharsPerLine} chữ)
      </label>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder={`Nhập mỗi dòng một câu (tối đa ${maxLines} dòng, mỗi dòng tối đa ${maxCharsPerLine} chữ)`}
        rows={4}
        className="content-textarea"
      />
      <p className="content-editor-note">
        Lưu ý: Tối đa {maxLines} dòng, mỗi dòng tối đa {maxCharsPerLine} chữ
      </p>
    </div>
  );
}

export default ContentEditor;

