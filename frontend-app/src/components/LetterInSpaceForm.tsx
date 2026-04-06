import { useState, useEffect } from 'react';
import './ContentEditor.css';

interface LetterInSpaceFormProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_SENTENCES = 20;
const MAX_CHARS_PER_SENTENCE = 40;

function LetterInSpaceForm({ value, onChange }: LetterInSpaceFormProps) {
  const [content, setContent] = useState(value || '');

  useEffect(() => {
    if (value !== undefined) setContent(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split('\n');
    // Truncate each line to max chars
    const clamped = lines.map(l => l.slice(0, MAX_CHARS_PER_SENTENCE));
    // Limit total lines
    const limited = clamped.slice(0, MAX_SENTENCES);
    const newValue = limited.join('\n');
    setContent(newValue);
    onChange(newValue);
  };

  const lines = content.split('\n');
  const lineCount = lines.length;

  return (
    <div className="content-editor">
      <label>
        Câu chữ rơi xuống — mỗi dòng là một câu ({lineCount}/{MAX_SENTENCES} dòng)
      </label>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder={`Nhập mỗi dòng một câu, tối đa ${MAX_SENTENCES} dòng\nVí dụ:\nyêu em mãi mãi\nanh nhớ em nhiều lắm`}
        rows={6}
        className="content-textarea"
      />
      <p className="content-editor-note">
        Tối đa {MAX_SENTENCES} dòng · Mỗi dòng tối đa {MAX_CHARS_PER_SENTENCE} ký tự · Các câu sẽ rơi ngẫu nhiên trên màn hình
      </p>
    </div>
  );
}

export default LetterInSpaceForm;
