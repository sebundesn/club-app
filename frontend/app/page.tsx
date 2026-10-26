'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { messages, Lang, SeasonKey } from './intro/messages';
import './intro/intro.css';

const SEASONS: { key: SeasonKey; emoji: string }[] = [
  { key: 'spring', emoji: '🌸' },
  { key: 'summer', emoji: '🏖️' },
  { key: 'autumn', emoji: '🍁' },
  { key: 'winter', emoji: '⛄' },
];

const ACTIVITY_ICONS = ['🥾', '🏕️', '🏐', '🎿'];

const LANG_KEY = 'intro-lang';
const INSTAGRAM_URL = 'https://www.instagram.com/hirosaki_wangel/';

/** 画面に入ったら .in を付ける。動きを減らす設定の人には最初から出す */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** スクロール量を --scroll に入れて、丘と雲を奥行きつきで動かす */
function useParallax(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      ref.current?.style.setProperty('--scroll', String(Math.min(window.scrollY, 800)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

function SeasonPhoto({ season, emoji, alt }: { season: SeasonKey; emoji: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`season-photo season-${season}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート(画像最適化なし)なので素の img
        <img src={`/seasons/${season}.jpg`} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      )}
      {failed && <span className="season-placeholder" aria-hidden="true">{emoji}</span>}
    </div>
  );
}

export default function IntroPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Lang>('ja');
  const [loading, setLoading] = useState(true);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const popId = useRef(0);
  const t = messages[lang];

  // 言語: 保存した選択 > ブラウザの言語。SSRと揃えるため最初は ja で、マウント後に切り替える
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch {
      /* 保存できない環境では毎回ブラウザの言語で決める */
    }
    const next: Lang = saved === 'en' || saved === 'ja' ? saved : navigator.language.startsWith('ja') ? 'ja' : 'en';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage / navigator はマウント後にしか読めない
    setLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = messages[lang].docTitle;
  }, [lang]);

  const changeLang = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* 保存できなくても表示は切り替わる */
    }
  };

  // ローディング画面(ステージ開始の演出)。長く待たせない
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setLoading(false), reduce ? 200 : 1600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.style.overflow = loading ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [loading]);

  useReveal();
  useParallax(rootRef);

  // 最初の画面を数秒見せたら、活動のセクションまで自動でスライドする。
  // 触り始めた(スクロール・タッチ・キー)ら止める
  useEffect(() => {
    if (loading) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      events.forEach((e) => window.removeEventListener(e, cancel));
    };
    events.forEach((e) => window.addEventListener(e, cancel, { passive: true }));

    const timer = setTimeout(() => {
      const target = document.getElementById('about');
      if (!target || window.scrollY > 40) {
        cancel();
        return;
      }
      const from = window.scrollY;
      const to = target.getBoundingClientRect().top + from - 56; // 上のHUDの分
      const duration = 1400;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min((now - t0) / duration, 1);
        const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        window.scrollTo(0, from + (to - from) * eased);
        if (k < 1) raf = requestAnimationFrame(step);
        else cancel();
      };
      raf = requestAnimationFrame(step);
    }, 1500);

    return cancel;
  }, [loading]);

  // ?ブロックを叩くとコインが飛び出す
  const hitBlock = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = ++popId.current;
    setPops((p) => [...p, { id, x: rect.left + rect.width / 2, y: rect.top }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 800);
  }, []);

  return (
    <div className="intro" ref={rootRef}>
      {/* ローディング */}
      <div className={`intro-loading ${loading ? '' : 'done'}`} aria-hidden={!loading} role="status">
        <div className="loading-climb" aria-hidden="true">
          <svg viewBox="0 0 200 110" width="200" height="110">
            <polygon points="0,110 70,30 100,60 130,15 200,110" fill="#4a6b52" />
            <polygon points="130,15 118,32 126,28 132,36 140,28 146,32" fill="#fff" />
            <polygon points="70,30 62,42 68,40 72,46 78,40 82,42" fill="#fff" />
          </svg>
          <span className="loading-shoe">🥾</span>
        </div>
        <div className="loading-bar"><span /></div>
        <div className="loading-text">{t.loading}</div>
      </div>

      {/* HUD */}
      <div className="intro-hud">
        <div className="lang-switch" role="group" aria-label="Language">
          <button type="button" className={lang === 'ja' ? 'on' : ''} onClick={() => changeLang('ja')} aria-pressed={lang === 'ja'}>日本語</button>
          <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => changeLang('en')} aria-pressed={lang === 'en'}>EN</button>
        </div>
      </div>

      {/* ヒーロー */}
      <section className="intro-hero">
        <div className="sky-layer">
          <span className="cloud c1" /><span className="cloud c2" /><span className="cloud c3" />
        </div>
        <div className="hill hill-back" />
        <div className="hill hill-mid" />
        <div className="hill hill-front" />

        <div className="hero-body">
          {t.kicker && <p className="hero-kicker">{t.kicker}</p>}
          <h1 className="hero-title">
            {t.titleTop && <span>{t.titleTop}</span>}
            <span className="hero-title-main">
              {t.titleMain.split('|').map((w, i) => (
                <span key={w} className="title-word">{i > 0 && ' '}{w}</span>
              ))}
            </span>
          </h1>
          {t.lead && <p className="hero-lead">{t.lead}</p>}
        </div>

        <button type="button" className="qblock qb1" onClick={hitBlock} aria-label={t.blockLabel}>?</button>
        <button type="button" className="qblock qb2" onClick={hitBlock} aria-label={t.blockLabel}>?</button>
        <button type="button" className="qblock qb3" onClick={hitBlock} aria-label={t.blockLabel}>?</button>
        <div className="pipe pipe-hero" aria-hidden="true"><i /></div>
        <div className="ground" aria-hidden="true" />
      </section>

      {/* 活動内容 */}
      <section className="intro-section" id="about">
        <h2 className="section-title reveal">{t.activitiesTitle}</h2>
        {t.activitiesSub && <p className="section-sub reveal">{t.activitiesSub}</p>}
        <ul className="activity-grid">
          {t.activities.map((a, i) => (
            <li key={a.name} className="activity-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="activity-icon" aria-hidden="true">{ACTIVITY_ICONS[i]}</span>
              <h3>{a.name}</h3>
              <p>{a.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 活動日・年会費 */}
      <section className="intro-section intro-info">
        <h2 className="section-title reveal">{t.infoTitle}</h2>
        <div className="info-grid">
          {t.info.map((it, i) => (
            <div key={it.label} className="info-card reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="info-label">{it.label}</div>
              <div className="info-value">{it.value}</div>
              {it.note && <div className="info-note">{it.note}</div>}
            </div>
          ))}
        </div>
        {t.free && <p className="info-free reveal">★ {t.free}</p>}
      </section>

      {/* 春夏秋冬 */}
      <section className="intro-section">
        <h2 className="section-title reveal">{t.seasonsTitle}</h2>
        {t.seasonsSub && <p className="section-sub reveal">{t.seasonsSub}</p>}
        <div className="season-grid">
          {SEASONS.map((s, i) => (
            <article key={s.key} className="season-card reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="season-stage">1-{i + 1}</div>
              <SeasonPhoto season={s.key} emoji={s.emoji} alt={t.seasons[s.key].title} />
              <h3>{s.emoji} {t.seasons[s.key].title}</h3>
              {t.seasons[s.key].text && <p>{t.seasons[s.key].text}</p>}
            </article>
          ))}
        </div>
      </section>

      {/* 参加案内 */}
      <section className="intro-join">
        <div className="pipe pipe-join" aria-hidden="true"><i /></div>
        <div className="join-body reveal">
          {t.joinTitle && <h2>{t.joinTitle}</h2>}
          <p>{t.joinText}</p>
          <a className="insta-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {t.instagram}
          </a>
        </div>
        <div className="ground" aria-hidden="true" />
      </section>

      {/* コイン */}
      {pops.map((p) => (
        <span key={p.id} className="coin-pop" style={{ left: p.x, top: p.y }} aria-hidden="true" />
      ))}
    </div>
  );
}
