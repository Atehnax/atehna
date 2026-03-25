# Route performance matrix

| Route | First-load JS before (kB) | First-load JS after (kB) | HTML before (B) | HTML after (B) | Largest same-origin request before (B) | Largest same-origin request after (B) |
|---|---:|---:|---:|---:|---:|---:|
| / | 101 | 101 | 29826 | 31991 | 172832 | 172832 |
| /products | 99.5 | 99.6 | 26504 | 28936 | 172832 | 172832 |
| /products/[category] | 104 | 105 | 22381 | 24813 | 172832 | 172832 |
| /admin/orders | 115 | 115 | 59243 | 61593 | 172832 | 172832 |
| /admin/orders/[orderId] | 111 | 111 | 45034 | 47544 | 172832 | 172832 |
| /admin/analitika | 103 | 103 | 26402 | 28752 | 172832 | 172832 |
| /admin/analitika/splet | 92.9 | 93.1 | 26049 | 28399 | 172832 | 172832 |
| /admin/kategorije | 137 | 89.4 | 90708 | 83415 | 172832 | 172832 |
| /admin/kategorije/predogled | 137 | 89.4 | 78442 | 76082 | 172832 | 172832 |
| /admin/kategorije/miller-view | 137 | 89.4 | 76748 | 73376 | 172832 | 172832 |
| /admin/artikli | 111 | 112 | 245474 | 247824 | 172832 | 172832 |
| /admin/arhiv | 105 | 106 | 32684 | 35034 | 172832 | 172832 |

## Notable request changes

- /admin/kategorije: heavy chunk /chunks/9640-* before=69937B, after=0B (removed from initial route path).
- /admin/kategorije/predogled: heavy chunk /chunks/9640-* before=69937B, after=0B (removed from initial route path).
- /admin/kategorije/miller-view: heavy chunk /chunks/9640-* before=69937B, after=0B (removed from initial route path).

## Browser startup cost

- Could not collect real-browser startup timings in this environment because Playwright browser binaries are blocked by network policy (403 from CDN).

## Top 5 worst routes by user impact (pre-change)

1. /admin/kategorije
2. /admin/kategorije/predogled
3. /admin/kategorije/miller-view
4. /admin/orders
5. /admin/artikli
