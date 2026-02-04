import { useParams } from 'react-router-dom';
import LoveLetter from '../components/templates/LoveLetter';
import './TemplatePreviewPage.css';

function TemplatePreviewPage() {
  const { templateName } = useParams<{ templateName: string }>();
  
  // For preview, show sample content
  // In a real scenario, you might want to fetch template details or show a demo
  const sampleContent = ['T', 'K']; // Sample content for preview

  return (
    <div className="template-preview-page">
      <LoveLetter contentLines={sampleContent} />
    </div>
  );
}

export default TemplatePreviewPage;

