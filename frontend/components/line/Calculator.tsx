'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'receipt-calc-history';
const MAX_HISTORY = 50;

interface Entry {
  expr: string;
  result: string;
}

/** + − × ÷ と小数だけの式を計算する。eval は使わない。計算できない式は null。 */
function evaluate(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-×÷]/g);
  if (!tokens || tokens.join('') !== expr) return null;
  let pos = 0;
  const term = (): number | null => {
    let left = number();
    while (left !== null && (tokens[pos] === '×' || tokens[pos] === '÷')) {
      const op = tokens[pos++];
      const right = number();
      if (right === null) return null;
      if (op === '÷' && right === 0) return null;
      left = op === '×' ? left * right : left / right;
    }
    return left;
  };
  const number = (): number | null => {
    let sign = 1;
    if (tokens[pos] === '-') {
      sign = -1;
      pos++;
    }
    const t = tokens[pos++];
    if (t === undefined || /[+\-×÷]/.test(t)) return null;
    return sign * Number(t);
  };
  let sum = term();
  while (sum !== null && (tokens[pos] === '+' || tokens[pos] === '-')) {
    const op = tokens[pos++];
    const right = term();
    if (right === null) return null;
    sum = op === '+' ? sum + right : sum - right;
  }
  return sum !== null && pos === tokens.length && Number.isFinite(sum) ? sum : null;
}

const format = (n: number) => String(Math.round(n * 1e8) / 1e8);

// 横長に並べる: 3行 × 6列
const KEYS = ['7', '8', '9', '÷', 'C', '⌫', '4', '5', '6', '×', '0', '.', '1', '2', '3', '-', '+', '='];

function loadHistory(): Entry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 右下の電卓ボタンと、開くと出る電卓。計算履歴はサイトを閉じると消える(sessionStorage)。 */
export default function Calculator({ raised = false }: { raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage はブラウザでしか読めないので、表示後に読む。
    setHistory(loadHistory());
  }, []);

  const saveHistory = (next: Entry[]) => {
    setHistory(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 保存できなくても計算は続けられる
    }
  };

  const live = expr ? evaluate(expr) : null;

  const press = (key: string) => {
    if (key === '=') {
      if (live === null) return;
      const result = format(live);
      saveHistory([{ expr, result }, ...history].slice(0, MAX_HISTORY));
      setExpr(result);
      return;
    }
    // 演算子が続いたら、あとのものに置き換える(マイナスは負数として続けられる)
    if (/[+×÷]/.test(key) && /[+\-×÷]$/.test(expr)) {
      setExpr(expr.replace(/[+\-×÷]+$/, '') + key);
      return;
    }
    setExpr(expr + key);
  };

  return (
    <>
      <button
        type="button"
        className={`la-calc-fab${raised ? ' raised' : ''}`}
        aria-label="電卓を開く"
        onClick={() => setOpen(!open)}
      >
        🖩
      </button>

      {open && (
        // 背景を暗くせず、後ろのレシートも見たり操作したりできる
        <div className={`la-calc${raised ? ' raised' : ''}`} role="dialog" aria-label="電卓">
          <div className="la-calc-top">
            <button
              type="button"
              className="la-calc-clock"
              aria-label="計算履歴"
              aria-pressed={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              🕒
            </button>
            <button type="button" className="la-calc-close" aria-label="閉じる" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          {showHistory && (
            <div className="la-calc-history">
              {history.length === 0 ? (
                <p className="la-calc-none">履歴はありません</p>
              ) : (
                history.map((h, i) => (
                  <button key={i} type="button" className="la-calc-entry" onClick={() => setExpr(h.result)}>
                    <span>{h.expr}</span>
                    <strong>= {Number(h.result).toLocaleString()}</strong>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="la-calc-display">
            <span className="la-calc-expr">{expr || '0'}</span>
            <span className="la-calc-live">
              {live !== null && /[+\-×÷]/.test(expr.slice(1)) ? `= ${live.toLocaleString()}` : ''}
            </span>
          </div>

          <div className="la-calc-keys">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`la-calc-key${/[+\-×÷]/.test(k) ? ' op' : ''}${k === '=' ? ' eq' : ''}${k === 'C' || k === '⌫' ? ' fn' : ''}`}
                onClick={() => (k === 'C' ? setExpr('') : k === '⌫' ? setExpr(expr.slice(0, -1)) : press(k))}
              >
                {k === '-' ? '−' : k}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
