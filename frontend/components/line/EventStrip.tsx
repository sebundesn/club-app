import Link from 'next/link';

interface Props {
  title: string;
  sub: string;
  /** タップで開く、そのイベントの全件ページ */
  href: string;
  /** ＋ボタンで開く、アップロードページ */
  uploadHref: string;
  uploadLabel: string;
  /** 見本のサムネイル(先頭4枚まで使う) */
  thumbs: string[];
}

/** イベント名と＋ボタン、その下に見本4枚。押すとそのイベントの全件ページへ。 */
export default function EventStrip({ title, sub, href, uploadHref, uploadLabel, thumbs }: Props) {
  const shown = thumbs.slice(0, 4);
  return (
    <li className="la-event">
      <div className="la-event-head">
        <Link href={href} className="la-event-text">
          <span className="la-album-title">{title || '(無題)'}</span>
          <span className="la-album-sub">{sub}</span>
        </Link>
        <Link href={uploadHref} className="la-plus" aria-label={uploadLabel}>
          ＋
        </Link>
      </div>
      <Link href={href} className="la-strip" aria-label={`${title || '(無題)'}をすべて見る`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="la-strip-cell">
            {shown[i] && (
              // eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない
              <img src={shown[i]} alt="" loading="lazy" />
            )}
          </span>
        ))}
      </Link>
    </li>
  );
}
