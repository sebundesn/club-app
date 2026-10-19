#!/bin/bash
# LINE公式アカウントのリッチメニューを作成し、全員のデフォルトメニューにする。
#
# 使い方:
#   LINE_CHANNEL_ACCESS_TOKEN=xxxx SITE_URL=https://xxxx.cloudfront.net \
#     ./scripts/richmenu/create.sh path/to/menu.png
#
# 画像は 2500x843 px、PNG/JPEG、1MB以内。左から「予定表」「部費」「アルバム」の3分割で作る。
# LINE_CHANNEL_ACCESS_TOKEN は Messaging API チャネルの「チャネルアクセストークン(長期)」。
# リッチメニューの作成・設定は無料で、メッセージ通数にも数えられない。
set -euo pipefail

IMAGE="${1:?メニュー画像のパスを渡してください}"
: "${LINE_CHANNEL_ACCESS_TOKEN:?LINE_CHANNEL_ACCESS_TOKEN が必要です}"
: "${SITE_URL:?SITE_URL が必要です}"
SITE_URL="${SITE_URL%/}"

[ -f "$IMAGE" ] || { echo "画像が見つかりません: $IMAGE" >&2; exit 1; }

API=https://api.line.me/v2/bot
AUTH="Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"

# 3分割(2500px / 3 ≒ 833px)。
# 全ボタンに openExternalBrowser=1 を付けて、端末の外部ブラウザ(Safari/Chrome)で開く。
# LINE内ブラウザでは初回ログインの認証番号が見られず、ログイン状態も外部ブラウザと共有されないため。
BODY=$(cat <<JSON
{
  "size": {"width": 2500, "height": 843},
  "selected": true,
  "name": "club-app-menu",
  "chatBarText": "メニュー",
  "areas": [
    {"bounds": {"x": 0,    "y": 0, "width": 833, "height": 843},
     "action": {"type": "uri", "label": "予定表", "uri": "$SITE_URL/calendar?openExternalBrowser=1"}},
    {"bounds": {"x": 833,  "y": 0, "width": 834, "height": 843},
     "action": {"type": "uri", "label": "部費",   "uri": "$SITE_URL/payments?openExternalBrowser=1"}},
    {"bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
     "action": {"type": "uri", "label": "アルバム", "uri": "$SITE_URL/album?openExternalBrowser=1"}}
  ]
}
JSON
)

RICHMENU_ID=$(curl -fsS -X POST "$API/richmenu" -H "$AUTH" -H 'Content-Type: application/json' -d "$BODY" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["richMenuId"])')
echo "created: $RICHMENU_ID"

case "$IMAGE" in
  *.png) CT=image/png ;;
  *)     CT=image/jpeg ;;
esac
curl -fsS -X POST "https://api-data.line.me/v2/bot/richmenu/$RICHMENU_ID/content" \
  -H "$AUTH" -H "Content-Type: $CT" --data-binary "@$IMAGE" >/dev/null
echo "image uploaded"

curl -fsS -X POST "$API/user/all/richmenu/$RICHMENU_ID" -H "$AUTH" >/dev/null
echo "set as default for all users"
