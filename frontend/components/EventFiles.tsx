'use client';

import { EventFile } from '../app/utils/schema';
import { eventFileSrc } from '../app/utils/api';
import './eventFiles.css';

interface Props {
  files: EventFile[];
  /** 渡すと各ファイルに × が付く(管理ページの編集用) */
  onDelete?: (file: EventFile) => void;
}

/** イベントに付いたPDF・画像。押すと別のタブで開く。画像は小さく並べ、PDFは名前で出す。 */
export default function EventFiles({ files, onDelete }: Props) {
  if (files.length === 0) return null;
  return (
    <ul className="ev-files">
      {files.map((f) => (
        <li key={f.id} className={`ev-file ${f.kind}`}>
          <a href={eventFileSrc(f.url)} target="_blank" rel="noopener noreferrer" className="ev-file-link">
            {f.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない
              <img src={eventFileSrc(f.url)} alt={f.name || '画像'} loading="lazy" />
            ) : (
              <>
                <span className="ev-file-icon" aria-hidden="true">
                  PDF
                </span>
                <span className="ev-file-name">{f.name || 'PDF'}</span>
              </>
            )}
          </a>
          {onDelete && (
            <button type="button" className="ev-file-remove" aria-label={`${f.name || 'ファイル'}を削除`} onClick={() => onDelete(f)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
