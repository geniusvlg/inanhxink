import { useState, useEffect } from 'react';
import { type Template } from '../data/mockTemplates';
import { getTemplates } from '../services/api';
import './TemplateSelector.css';

interface TemplateSelectorProps {
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
  onClearAll?: () => void;
}

function TemplateSelector({ selectedTemplate, onSelectTemplate, onClearAll }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    getTemplates().then((data) => {
      if (data.success) setTemplates(data.templates);
    });
  }, []);

  return (
    <div className="template-selector">
      <div className="template-selector-header">
        <span>Chọn template:</span>
        <span className="template-count">{templates.length} template</span>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => onSelectTemplate(template)}
          >
            <div className="template-preview">
              <img
                src={template.image_url || ''}
                alt={template.name}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-placeholder')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-placeholder';
                    fallback.textContent = template.name;
                    parent.appendChild(fallback);
                  }
                }}
              />
              {selectedTemplate?.id === template.id && (
                <div className="template-selected-indicator">
                  <svg className="template-check-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="template-info">
              <div className="template-name">{template.name}</div>
              <div className="template-price">{template.price.toLocaleString('vi-VN')}đ</div>
            </div>
          </div>
        ))}
      </div>
      {selectedTemplate && (
        <div className="template-selected-info">
          <div className="template-selected-row">
            <span className="template-selected-label">Template đã chọn:</span>
            <span className="template-selected-name">{selectedTemplate.name}</span>
          </div>
          <div className="template-selected-row">
            <span className="template-selected-label">Giá:</span>
            <span className="template-selected-price">{selectedTemplate.price.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
      )}

      {onClearAll && (
        <div className="clear-button-container">
          <button onClick={onClearAll} className="clear-button">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa toàn bộ dữ liệu đã nhập
          </button>
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;
