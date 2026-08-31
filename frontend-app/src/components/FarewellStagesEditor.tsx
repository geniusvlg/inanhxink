import './FarewellStagesEditor.css';

interface FarewellStagesEditorProps {
  messages: string[];
  onChange: (messages: string[]) => void;
}

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 36;

function FarewellStagesEditor({ messages, onChange }: FarewellStagesEditorProps) {
  const rows = messages.length ? messages : [''];

  const update = (index: number, value: string) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };

  const remove = (index: number) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  const add = () => {
    if (rows.length >= MAX_MESSAGES) return;
    onChange([...rows, '']);
  };

  return (
    <section className="farewell-stages">
      <div className="farewell-stages__heading">
        <h3>Lời nhắn trên bảng chuyến bay</h3>
      </div>

      <div className="farewell-stages__list">
        {rows.map((message, index) => (
          <div className="farewell-stages__row" key={index}>
            <input
              type="text"
              maxLength={MAX_MESSAGE_CHARS}
              value={message}
              onChange={(event) => update(index, event.target.value)}
              placeholder="Nhập lời nhắn..."
            />
            <span className="farewell-stages__count">{message.length}/{MAX_MESSAGE_CHARS}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={rows.length <= 1}
            >
              Xóa
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="farewell-stages__add"
        onClick={add}
        disabled={rows.length >= MAX_MESSAGES}
      >
        Thêm lời nhắn
      </button>
    </section>
  );
}

export default FarewellStagesEditor;
