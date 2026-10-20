'use client';

import { useRef } from 'react';
import Link from 'next/link';

interface Props {
  title: string;
  sub: string;
  /** タップで開く、そのイベントの全件ページ */
  href: string;
  uploadLabel: string;
  /** ＋ボタンで開くファイル選択の種類 */
  accept: string;
  /** ファイルを選び終えたとき */
  onPick: (files: File[]) => void;
  /** 見本のサムネイル(先頭4枚まで使う) */
  thumbs: string[];
}

/** イベント名と＋ボタン、その下に画像(最大4枚)。画像がなければ場所を空けない。押すとそのイベントの全件ページへ。 */
export default function EventStrip({ title, sub, href, uploadLabel, accept, onPick, thumbs }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const shown = thumbs.slice(0, 4);
  return (
    <li className="la-ev">
      <div className="la-ev-head">
        <h2 className="la-ev-title">
          <Link href={href} className="la-ev-text">
            {title || '(無題)'}
          </Link>
        </h2>
        <p className="la-album-sub la-ev-sub">{sub}</p>
        {/* ＋を押すと、そのままスマホの写真選択が開く */}
        <button type="button" className="la-plus" aria-label={uploadLabel} onClick={() => input.current?.click()}>
          ＋
        </button>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) onPick(files);
          }}
        />
      </div>
      {shown.length > 0 && (
        <Link href={href} className="la-strip" aria-label={`${title || '(無題)'}をすべて見る`}>
          {shown.map((src, i) => (
            <span key={i} className="la-strip-cell">
              {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
              <img src={src} alt="" loading="lazy" />
            </span>
          ))}
        </Link>
      )}
    </li>
  );
}
