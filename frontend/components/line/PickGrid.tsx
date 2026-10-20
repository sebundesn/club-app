'use client';

import { useEffect, useMemo, useRef } from 'react';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  /** 選べる最大数。超えた分は無視する */
  max: number;
  disabled?: boolean;
}

/** 端末から選んだ写真・動画のプレビュー。番号つきの丸で選択順を示し、押すと選択を外せる。 */
export default function PickGrid({ files, onChange, accept, max, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f), video: f.type.startsWith('video/') })),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const add = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    onChange([...files, ...picked].slice(0, max));
  };

  return (
    <div className="la-grid">
      <button
        type="button"
        className="la-pick-tile"
        aria-label="ファイルを選ぶ"
        disabled={disabled || files.length >= max}
        onClick={() => input.current?.click()}
      >
        ＋
      </button>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={add} />

      {previews.map((p, i) => (
        <button
          key={`${p.file.name}-${p.file.size}-${i}`}
          type="button"
          className="la-cell"
          aria-label={`${i + 1}番目の選択を外す`}
          disabled={disabled}
          onClick={() => onChange(files.filter((_, j) => j !== i))}
        >
          {p.video ? (
            <video src={`${p.url}#t=0.1`} preload="metadata" muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ローカルのプレビュー(blob)なので最適化の対象外
            <img src={p.url} alt="" />
          )}
          <span className="la-check">{i + 1}</span>
          {p.video && <span className="la-badge">▶</span>}
        </button>
      ))}
    </div>
  );
}
