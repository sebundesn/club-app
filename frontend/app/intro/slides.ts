import { Lang, SeasonKey } from './messages';

export type Slide = {
  src: string;
  season: SeasonKey;
  caption: Record<Lang, string>;
  /** 正方形に切り抜くときに、どこを見せるか(object-position) */
  position?: string;
};

const chokai = { ja: '鳥海山登山', en: 'Mt. Chokai hike' };
const oirase = { ja: '奥入瀬渓流ハイキング', en: 'Oirase Stream hike' };
const tournament = { ja: 'スポーツ大会', en: 'Sports tournament' };
const camp = { ja: 'キャンプ', en: 'Camping' };
const appi ={ ja: '安比スキー合宿', en: 'Appi ski camp' };

// 写真は frontend/public/seasons/ に置く。増えたら、ここに足す。
// 顔が写っている写真は、載せる前に顔を軽くぼかしてある
export const slides: Slide[] = [
  { src: '/seasons/spring-1.jpg', season: 'spring', caption: { ja: '恐山観光', en: 'Osorezan sightseeing' }, position: '40% 50%' },
  { src: '/seasons/spring-2.jpg', season: 'spring', caption: { ja: '八戸朝市観光', en: 'Hachinohe Morning Market sightseeing' } },
  { src: '/seasons/spring-3.jpg', season: 'spring', caption: { ja: '蕪島神社観光', en: 'Kabushima Shrine sightseeing' }, position: '50% 80%' },
  { src: '/seasons/spring-4.jpg', season: 'spring', caption: oirase, position: '50% 80%' },
  { src: '/seasons/spring-5.jpg', season: 'spring', caption: oirase, position: '30% 50%' },
  { src: '/seasons/summer-1.jpg', season: 'summer', caption: chokai, position: '50% 68%' },
  { src: '/seasons/summer-2.jpg', season: 'summer', caption: chokai, position: '50% 80%' },
  { src: '/seasons/summer-3.jpg', season: 'summer', caption: chokai },
  { src: '/seasons/summer-4.jpg', season: 'summer', caption: chokai, position: '50% 100%' },
  { src: '/seasons/summer-5.jpg', season: 'summer', caption: chokai, position: '50% 85%' },
  { src: '/seasons/summer-6.jpg', season: 'summer', caption: { ja: '早池峰山登山', en: 'Mt. Hayachine hike' }, position: '85% 50%' },
  { src: '/seasons/summer-7.jpg', season: 'summer', caption: camp, position: '55% 50%' },
  { src: '/seasons/summer-8.jpg', season: 'summer', caption: camp, position: '40% 50%' },
  { src: '/seasons/autumn-1.jpg', season: 'autumn', caption: tournament, position: '55% 50%' },
  { src: '/seasons/autumn-2.jpg', season: 'autumn', caption: tournament, position: '50% 85%' },
  { src: '/seasons/autumn-3.jpg', season: 'autumn', caption: camp, position: '50% 90%' },
  { src: '/seasons/autumn-4.jpg', season: 'autumn', caption: camp, position: '45% 50%' },
  { src: '/seasons/winter-1.jpg', season: 'winter', caption: appi, position: '35% 50%' },
  { src: '/seasons/winter-2.jpg', season: 'winter', caption: appi },
];
