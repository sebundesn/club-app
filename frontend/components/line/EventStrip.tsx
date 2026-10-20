'use client';

import { useRef } from 'react';
import Link from 'next/link';
import CoverFlow from './CoverFlow';

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
  /** 見出しの下にカバーフローで流す画像。渡さなければ見出しと＋だけ */
  thumbs?: string[];
}

/** イベント名と＋ボタン、その下に画像のカバーフロー。画像がなければ場所を空けない。名前を押すとそのイベントの全件ページへ。 */
export default function EventStrip({ title, sub, href, uploadLabel, accept, onPick, thumbs = [] }: Props) {
  const input = useRef<HTMLInputElement>(null);
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
      {thumbs.length > 0 && <CoverFlow href={href} label={`${title || '(無題)'}の写真・動画`} thumbs={thumbs} />}
    </li>
  );
}
