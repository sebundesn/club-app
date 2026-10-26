export type Lang = 'ja' | 'en';
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

type Messages = {
  docTitle: string;
  loading: string;
  kicker?: string;
  titleTop?: string;
  titleMain: string;
  lead?: string;
  blockLabel: string;
  activitiesTitle: string;
  activitiesSub?: string;
  activities: { name: string; text: string }[];
  infoTitle: string;
  info: { label: string; value: string; note?: string }[];
  free?: string;
  seasonsTitle: string;
  seasonsSub?: string;
  seasons: Record<SeasonKey, { title: string; text?: string }>;
  joinTitle?: string;
  joinText: string;
  instagram: string;
};

export const messages: Record<Lang, Messages> = {
  ja: {
    docTitle: '弘前大学ワンダーフォーゲル',
    loading: '山を登っています…',
    titleMain: '弘前大学|ワンダーフォーゲル',
    blockLabel: 'ブロックを叩く',
    activitiesTitle: '私たちの活動',
    activitiesSub: '各イベント参加自由',
    activities: [
      { name: '登山・ハイキング', text: '月2回(冬以外)' },
      { name: 'BBQ・キャンプ', text: '年5回' },
      { name: 'スポーツ', text: '週1回(冬以外)・スポーツ大会も' },
      { name: 'スキー・スノボ', text: '年3回・スキー合宿も' },
    ],
    infoTitle: '活動日と年会費',
    info: [
      { label: '部会(農生401)', value: '毎週月曜日' },
      { label: '週末の活動', value: '基本 土曜日'},
      { label: '年会費', value: '2,500円'},
    ],
    free: '各イベント 参加自由',
    seasonsTitle: '活動風景',
    seasons: {
      spring: { title: '春'},
      summer: { title: '夏'},
      autumn: { title: '秋'},
      winter: { title: '冬'},
    },
    joinText: '初心者も大歓迎。気軽に部会かInstaのDMに来て下さい!',
    instagram: 'Instagram',
  },
  en: {
    docTitle: 'Hirosaki University Wandervogel',
    loading: 'Climbing the mountain…',
    titleMain: 'Hirosaki University|Wandervogel',
    blockLabel: 'Hit the block',
    activitiesTitle: 'What We Do',
    activitiesSub: 'Join only the events you like',
    activities: [
      { name: 'Climbing & Hiking', text: 'Twice a month (except winter)' },
      { name: 'BBQ & Camping', text: '8 times a year' },
      { name: 'Sports', text: 'Once a week (except winter), plus sports tournaments' },
      { name: 'Skiing & Snowboarding', text: '3 times a year, plus a ski camp' },
    ],
    infoTitle: 'Schedule & Fee',
    info: [
      { label: 'Club meeting (Agri. & Life Sci. Bldg., Rm. 401)', value: 'Every Monday' },
      { label: 'Weekend activities', value: 'Usually Saturday' },
      { label: 'Annual fee', value: '¥2,500' },
    ],
    free: 'All events are optional',
    seasonsTitle: 'Activity Gallery',
    seasons: {
      spring: { title: 'Spring' },
      summer: { title: 'Summer' },
      autumn: { title: 'Autumn' },
      winter: { title: 'Winter' },
    },
    joinText: 'Beginners are very welcome. Drop by a club meeting or send us a DM on Instagram!',
    instagram: 'Instagram',
  },
};
