字体文件（Noto Serif SC / Noto Sans SC / ZCOOL QingKe HuangYou，均为 SIL OFL 开源字体）不入库。
重新获取：按 fonts-remote.css 中的 URL 下载到本目录，文件名把 "https://fonts.gstatic.com/" 去掉并把 "/" 换成 "_"，再由 fonts.css 引用。

印刷排版（press.py）另用 static/ 下的静态 TTF：Noto Serif SC、Noto Sans SC（400/700/900，正文，避免可变字体在 PDF 里变成 Type 3 而复制乱码），
Cinzel、Cormorant Garamond（封面上的 ASCHAM 和编号）。运行 sh fetch_static.sh 下载，同样不入库。
