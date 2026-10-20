// ヘッダーのナビに出す線画アイコン。色は文字色(currentColor)に合わせる
const paths: Record<string, React.ReactNode> = {
  // 山
  mountain: (
    <>
      <path d="M2 20 9 8l4 6 2-3 7 9Z" />
      <path d="m7.5 10.5 1.5 1 1.5-1" />
    </>
  ),
  // 写真
  album: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m3 17 5-4 4 3 3-2 6 4" />
    </>
  ),
  // レシート
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  // 王冠(部長・副部長)
  crown: (
    <>
      <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5Z" />
      <path d="M5 19h14" />
    </>
  ),
  // 財布(会計)
  wallet: (
    <>
      <path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3" />
      <path d="M20 12h-4a1.5 1.5 0 0 0 0 3h4" />
    </>
  ),
};

export type NavIconName = keyof typeof paths;

export default function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
