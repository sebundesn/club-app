'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReceiptDataStruct } from '../utils/schema';
import { backendURL, readErrorMessage, receiptSrc } from '../utils/api';
import { useToast } from '../../components/Toast';
import Calculator from '../../components/line/Calculator';
import EventStrip from '../../components/line/EventStrip';
import EventParticipants from '../../components/EventParticipants';
import MediaViewer from '../../components/line/MediaViewer';
import { setPendingFiles } from '../utils/pendingFiles';
import EventTimeline, { formatEventDate, formatEventRange, TimelineResult } from '../../components/line/EventTimeline';
import { defaultDay, eventIDsParam, parseEventIDs, uploadURL } from '../utils/eventGroup';
import '../line.css';

type LoadState = 'loading' | 'ok' | 'loggedOut' | 'error';

interface ApiEvent {
  id: number;
  title: string;
  date: string;
  images: { id: number; url: string }[] | null;
}

type FetchResult = TimelineResult<ReceiptDataStruct, Exclude<LoadState, 'ok' | 'loading'>>;

const toReceipt = (e: ApiEvent): ReceiptDataStruct => ({
  ID: e.id,
  Title: e.title,
  Date: e.date.split('T')[0],
  Images: e.images ?? [],
});

/** レシートを取得する。部員なら誰でも見られる。 */
function useFetchReceipts() {
  const { showToast } = useToast();
  return useCallback(
    async (query: string): Promise<FetchResult> => {
      try {
        const res = await fetch(`${backendURL}/api/getReceiptsInfo?${query}`, { credentials: 'include' });
        if (res.status === 401) return { ok: false, state: 'loggedOut' };
        if (!res.ok) {
          showToast(await readErrorMessage(res, 'レシートの取得に失敗しました。'), 'error');
          return { ok: false, state: 'error' };
        }
        const data: { events: ApiEvent[] | null; hasMore: boolean } = await res.json();
        return { ok: true, page: { items: (data.events ?? []).map(toReceipt), hasMore: data.hasMore } };
      } catch (e) {
        console.error('failed to load receipts:', e);
        showToast('通信に失敗しました。', 'error');
        return { ok: false, state: 'error' };
      }
    },
    [showToast],
  );
}

/** イベントのレシート。日付に関係なく取れる。連日のイベントなら日ごとに取って並べる。 */
function useEventReceipts(eventIDs: number[]) {
  const fetchReceipts = useFetchReceipts();
  const [events, setEvents] = useState<ReceiptDataStruct[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const idsKey = eventIDsParam(eventIDs);

  const load = useCallback(async () => {
    const results = await Promise.all(parseEventIDs(idsKey).map((id) => fetchReceipts(`eventID=${id}`)));
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) return setState(failed.state);
    setEvents(results.flatMap((r) => (r.ok ? r.page.items.slice(0, 1) : [])));
    setState('ok');
  }, [idsKey, fetchReceipts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  return { events, state, reload: load };
}

function Notice({ state }: { state: LoadState }) {
  if (state === 'loading') return <p className="la-empty">読み込み中…</p>;
  if (state === 'loggedOut') return <p className="la-notice">レシートを見るには、右上の「LINEでログイン」からログインしてください。</p>;
  if (state === 'error') return <p className="la-empty">取得できませんでした。</p>;
  return null;
}

const cursorOf = (r: ReceiptDataStruct) => ({ date: r.Date, id: r.ID });

/** レシート一覧。直近のイベントを中央に、上へスクロールで過去、下へスクロールで未来を読み足す。同じタイトルの連日のイベントは1行にまとめる。 */
function ReceiptList() {
  const router = useRouter();
  const fetchReceipts = useFetchReceipts();

  // ＋で選んだファイルをアップロードページに渡して、確認の画面へ進む
  const pickFor = (eventID: number, title: string, files: File[], group: number[]) => {
    setPendingFiles(files);
    router.push(uploadURL('/receipts/upload', eventID, title, group));
  };

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>レシート管理</h1>
      </div>

      <EventTimeline
        fetchPage={fetchReceipts}
        cursorOf={cursorOf}
        renderState={(state) => <Notice state={state} />}
        emptyMessage="イベントがありません。"
        titleOf={(r) => r.Title}
        renderGroup={(g, isNext) => {
          // 連日のイベントは1行にまとめる。＋は今日(期間外なら初日)に追加する
          const ids = g.map((r) => r.ID);
          const target = defaultDay(g.map((r) => ({ ...r, date: r.Date })))!;
          return (
            <EventStrip
              title={g[0].Title}
              sub={`${formatEventRange(g[0].Date, g[g.length - 1].Date)} ・ ${g.reduce((n, r) => n + r.Images.length, 0)}枚`}
              href={`/receipts?eventID=${eventIDsParam(ids)}`}
              uploadLabel={`${g[0].Title || '(無題)'}にレシートを追加`}
              accept="image/jpeg,image/png"
              onPick={(files) => pickFor(target.ID, target.Title, files, ids)}
              next={isNext}
            />
          );
        }}
      />

      <Calculator />
    </div>
  );
}

/**
 * 1つのイベントのレシートと参加者・徴収。レシートは押すと黒地で1枚ずつ見られる。
 * 連日のイベント(合宿など)は上の日付タブでレシートの日を切り替える。参加者・徴収額は全日程で共通(初日に記録する)。
 * レシートの削除は部員なら誰でも、支払い済みの切り替え・徴収額の設定は会計・部長だけ。
 */
function ReceiptDetail({ eventIDs, initialDay }: { eventIDs: number[]; initialDay: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { events, state, reload } = useEventReceipts(eventIDs);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState('');
  // 画面を出し分けるだけ。実際の権限チェックはサーバー側で行っている
  const canEdit = role === '会計' || role === '部長';
  const canEditMembers = canEdit || role === '副部長';
  const multi = eventIDs.length > 1;

  // 選んでいる日。URL の day があればその日、なければ今日(期間外なら初日)
  const [pickedDay, setPickedDay] = useState<number | null>(eventIDs.includes(initialDay) ? initialDay : null);
  const event =
    events.find((e) => e.ID === pickedDay) ?? (pickedDay === null ? defaultDay(events.map((e) => ({ ...e, date: e.Date }))) : undefined);
  const eventID = event?.ID ?? 0;

  const selectDay = (id: number) => {
    setPickedDay(id);
    setViewIndex(null);
    // 戻る・再読み込みでも同じ日を開けるように URL にも残す
    router.replace(`/receipts?eventID=${eventIDsParam(eventIDs)}&day=${id}`, { scroll: false });
  };

  useEffect(() => {
    const loadRole = async () => {
      try {
        const res = await fetch(`${backendURL}/api/checkAuth`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setRole(typeof data.role === 'string' ? data.role : '');
      } catch (e) {
        console.error('failed to check role:', e);
      }
    };
    loadRole();
  }, []);

  const items = useMemo(
    () =>
      (event?.Images ?? []).map((img) => ({
        id: img.id,
        kind: 'photo' as const,
        url: receiptSrc(img.url),
        can_delete: true,
      })),
    [event],
  );

  const remove = async (imageID: number) => {
    try {
      const res = await fetch(`${backendURL}/api/deleteImage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, image_id: imageID }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '画像の削除に失敗しました。'), 'error');
        return;
      }
      setViewIndex((i) => (i === null || items.length <= 1 ? null : Math.min(i, items.length - 2)));
      await reload();
    } catch (e) {
      console.error('failed to delete image:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const first = events[0];
  const last = events[events.length - 1];
  const dayIndex = events.findIndex((e) => e.ID === eventID);

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="レシート一覧に戻る" onClick={() => router.push('/receipts')}>
          ‹
        </button>
        <h1 className="la-bar-title">{first ? first.Title || '(無題)' : 'レシート'}</h1>
      </div>

      <Notice state={state} />

      {state === 'ok' && !event && <p className="la-empty">イベントが見つかりません。</p>}

      {event && multi && (
        <>
          <p className="la-meta la-meta-tight">
            {formatEventRange(first.Date, last.Date)} ・ {events.length}日間 ・ 合計{events.reduce((n, e) => n + e.Images.length, 0)}枚
          </p>
          <div className="la-chips la-day-tabs" role="tablist" aria-label="日付">
            {events.map((e, i) => (
              <button
                key={e.ID}
                type="button"
                role="tab"
                aria-selected={e.ID === eventID}
                className={`la-chip${e.ID === eventID ? ' active' : ''}`}
                onClick={() => selectDay(e.ID)}
              >
                {i + 1}日目 {formatEventDate(e.Date)}
                <span className="la-chip-count">{e.Images.length}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {event && (
        <>
          <p className="la-meta">
            {multi ? `${dayIndex + 1}日目 ・ ` : ''}
            {formatEventDate(event.Date)} ・ {event.Images.length}枚
          </p>
          {event.Images.length === 0 && <p className="la-empty">レシートがありません。右下の＋から追加できます。</p>}
          <div className="la-grid">
            {event.Images.map((img, i) => (
              <button key={img.id} type="button" className="la-cell" onClick={() => setViewIndex(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
                <img src={receiptSrc(img.url)} alt="レシート" loading="lazy" />
              </button>
            ))}
          </div>
          {/* 参加者・徴収は連日でも全日程で共通。初日のイベントにまとめて記録する */}
          <div className="la-participants">
            <EventParticipants key={first.ID} eventID={first.ID} canEditMembers={canEditMembers} canEdit={canEdit} />
          </div>
        </>
      )}

      <Calculator raised={state === 'ok'} />

      {state === 'ok' && event && (
        <ul className="la-notes">
          <li>JPEG・PNG(1枚20MBまで)の画像を選べます。</li>
          <li>{multi ? '1日' : '1つのイベント'}に入れられるのは20枚までです。</li>
          {multi && <li>レシートは日ごと、参加者・徴収額は全日程で共通です。右下の＋は、選んでいる日に追加します。</li>}
        </ul>
      )}

      {state === 'ok' && event && (
        <>
          <button type="button" className="la-fab" aria-label="レシートを追加" onClick={() => fileInput.current?.click()}>
            ＋
          </button>
          {/* ＋を押すと、そのままスマホの写真選択が開く */}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length === 0) return;
              setPendingFiles(files);
              router.push(uploadURL('/receipts/upload', event.ID, event.Title, eventIDs));
            }}
          />
        </>
      )}

      {viewIndex !== null && items.length > 0 && (
        <MediaViewer
          items={items}
          index={Math.min(viewIndex, items.length - 1)}
          onIndex={setViewIndex}
          onClose={() => setViewIndex(null)}
          onDelete={(item) => remove(item.id)}
          noun="レシート"
        />
      )}
    </div>
  );
}

function ReceiptsContent() {
  const params = useSearchParams();
  const eventIDs = parseEventIDs(params.get('eventID'));
  return eventIDs.length > 0 ? (
    <ReceiptDetail key={eventIDsParam(eventIDs)} eventIDs={eventIDs} initialDay={Number(params.get('day'))} />
  ) : (
    <ReceiptList />
  );
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function ReceiptsPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <ReceiptsContent />
    </Suspense>
  );
}
