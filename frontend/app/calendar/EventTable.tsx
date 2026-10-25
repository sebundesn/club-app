import { UpcomingRow } from '../utils/upcoming';

interface EventTableProps {
  rows: UpcomingRow[];
  dayNames: string[];
  /** 行を押したときの動作。undefined を返す行(押せない行)は渡さない側で判断する */
  onSelect: (date: string) => void;
  /** 予定のない行も押せるか。既定は押せない */
  canSelectEmpty?: boolean;
  emptyMessage: string;
}

const weekdayClass = (weekday: number) => (weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : '');

/** 日付・曜日・内容の3列で予定を並べる表 */
export default function EventTable({ rows, dayNames, onSelect, canSelectEmpty = false, emptyMessage }: EventTableProps) {
  if (rows.length === 0) {
    return <p className="upcoming-empty">{emptyMessage}</p>;
  }

  return (
    <div className="upcoming-table" role="table">
      <div className="upcoming-row upcoming-head" role="row">
        <span role="columnheader">日付</span>
        <span role="columnheader">曜日</span>
        <span role="columnheader">内容</span>
      </div>
      {rows.map((row) => {
        const hasEvents = row.titles.length > 0;
        const clickable = hasEvents || canSelectEmpty;
        return (
          <button
            key={`${row.date}-${row.end?.date ?? ''}`}
            type="button"
            role="row"
            disabled={!clickable}
            className={`upcoming-row upcoming-item${row.isToday ? ' today' : ''}`}
            onClick={() => onSelect(row.date)}
          >
            {/* 連日の予定は、開始日の下に「〜最終日」を出す */}
            <span className="upcoming-date">
              {row.month}/{row.day}
              {row.end && <span className="upcoming-until">〜{row.end.month === row.month ? '' : `${row.end.month}/`}{row.end.day}</span>}
            </span>
            <span className="upcoming-weekday">
              <span className={weekdayClass(row.weekday)}>{dayNames[row.weekday]}</span>
              {row.end && <span className={`upcoming-until ${weekdayClass(row.end.weekday)}`}>〜{dayNames[row.end.weekday]}</span>}
            </span>
            <span className="upcoming-content">
              {hasEvents ? (
                row.titles.map((t, i) => <span key={i}>{t}</span>)
              ) : (
                <span className="upcoming-empty">予定なし</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
