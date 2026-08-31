import './LetterInSpaceForm.css';

interface LetterInSpaceFormProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_SENTENCES = 20;
const MAX_CHARS_PER_SENTENCE = 40;

function LetterInSpaceForm({ value, onChange }: LetterInSpaceFormProps) {
  const sentences = (value ? value.split('\n') : ['']).slice(0, MAX_SENTENCES);

  const update = (index: number, sentence: string) => {
    const next = [...sentences];
    next[index] = sentence.slice(0, MAX_CHARS_PER_SENTENCE);
    onChange(next.join('\n'));
  };

  const remove = (index: number) => {
    if (sentences.length <= 1) return;
    onChange(sentences.filter((_, sentenceIndex) => sentenceIndex !== index).join('\n'));
  };

  const add = () => {
    if (sentences.length >= MAX_SENTENCES) return;
    onChange([...sentences, ''].join('\n'));
  };

  return (
    <section className="letter-space">
      <div className="letter-space__heading">
        <h3>Câu chữ rơi xuống</h3>
        <span>{sentences.length}/{MAX_SENTENCES} câu</span>
      </div>

      <div className="letter-space__list">
        {sentences.map((sentence, index) => (
          <div className="letter-space__row" key={index}>
            <span className="letter-space__number">{index + 1}</span>
            <input
              type="text"
              maxLength={MAX_CHARS_PER_SENTENCE}
              value={sentence}
              onChange={(event) => update(index, event.target.value)}
              placeholder={`Nhập câu ${index + 1}...`}
            />
            <span className="letter-space__count">
              {sentence.length}/{MAX_CHARS_PER_SENTENCE}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={sentences.length <= 1}
              aria-label={`Xóa câu ${index + 1}`}
            >
              Xóa
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="letter-space__add"
        onClick={add}
        disabled={sentences.length >= MAX_SENTENCES}
      >
        + Thêm câu
      </button>

      <p className="letter-space__note">
        Mỗi câu tối đa {MAX_CHARS_PER_SENTENCE} ký tự · Các câu sẽ rơi ngẫu nhiên trên màn hình
      </p>
    </section>
  );
}

export default LetterInSpaceForm;
