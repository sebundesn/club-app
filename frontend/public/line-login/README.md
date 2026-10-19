LINEログインボタンに使うLINE公式のアイコン(白・透過、DeskTop / 2x / 44dp の line_88.png)。改変せずに使っている。
入手元と利用ガイドライン: https://developers.line.biz/en/docs/line-login/login-button/

ボタンの色・文言は、ガイドラインの定めに合わせて CSS で作っている(components/LineLoginButton.tsx / header.css)。
- 基本色 #06C755、ホバーは #000000 を10%、押下は30%重ねる
- アイコンとの境目の縦線は #000000 の8%
- 文言は日本語の推奨表記「LINEでログイン」(長)・「ログイン」(短)。改行しない
