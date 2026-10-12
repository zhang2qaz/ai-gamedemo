#!/bin/sh
# 下载排版用的静态 TTF 到 static/（不入库）。Google Fonts 对老 UA 返回逐字重的 TTF，嵌入 PDF 是 CID TrueType，复制文字不乱码。
set -e
cd "$(dirname "$0")"; mkdir -p static
get() {  # $1=family(URL形式) $2=weight $3=保存文件名
  [ -s "static/$3" ] && return
  url=$(curl -sS -A "Mozilla/4.0" "https://fonts.googleapis.com/css?family=$1:$2" | grep -o "https://[^)]*\.ttf" | head -1)
  curl -sS -o "static/$3" "$url"; echo "static/$3"
}
for w in 400:Regular 700:Bold 900:Black; do
  get "Noto+Serif+SC" "${w%%:*}" "NotoSerifCJKsc-${w##*:}.ttf"
  get "Noto+Sans+SC" "${w%%:*}" "NotoSansCJKsc-${w##*:}.ttf"
done
get "Cinzel" 500 Cinzel-Medium.ttf; get "Cinzel" 700 Cinzel-Bold.ttf
get "Cormorant+Garamond" 500 CormorantGaramond-Medium.ttf
get "Cormorant+Garamond" 600 CormorantGaramond-SemiBold.ttf
get "Cormorant+Garamond" 700 CormorantGaramond-Bold.ttf
