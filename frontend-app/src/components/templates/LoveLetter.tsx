import './LoveLetter.css';

interface LoveLetterProps {
  contentLines: string[];
}

function LoveLetter({ contentLines }: LoveLetterProps) {
  // Format content lines - join with ❤️ or display as is
  // For "T❤️K" style, if we have 2 lines, format them with heart
  let displayText = '';
  if (contentLines.length >= 2) {
    displayText = `${contentLines[0]}❤️${contentLines[1]}`;
  } else if (contentLines.length === 1) {
    displayText = contentLines[0];
  } else {
    displayText = 'Love Letter';
  }

  return (
    <div className="love-letter-template">
      <div className="love-letter-container">
        {/* Top text */}
        {contentLines.length > 0 && (
          <div className="love-letter-text">
            {displayText}
          </div>
        )}
        
        {/* Envelope */}
        <div className="envelope-wrapper">
          <div className="envelope">
            <div className="envelope-front">
              <div className="envelope-heart">❤️</div>
              <div className="envelope-stamp"></div>
            </div>
            <div className="envelope-flap"></div>
            <div className="envelope-back"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoveLetter;

