# SnowKit WhatsApp Player

Paket ini memisahkan fitur `/player` dari Dyno dan merapikannya agar SnowKit SDK menjadi satu-satunya lapisan akses ke SnowKit API.

## Isi ZIP

```text
assets/
  player.html        struktur player
  player.css         tampilan player
  player.js          playback, progress, dan lirik sinkron
src/
  snowkit/
    SnowKitClient.ts integrasi @luanxdd/snowkit
  player/
    Artwork.ts       mengubah cover menjadi data URL
    PlayerHtml.ts    menggabungkan HTML + CSS + JS + data sesi
    SnowKitWhatsAppPlayer.ts alur lengkap player
  rich/
    RichHtmlPayload.ts payload raw Rich HTML WhatsApp
  adapters/
    ZapoRichHtmlSender.ts
    BaileysRichHtmlSender.ts
examples/
  zapo.ts
  baileys.ts
```

## Persyaratan

- Node.js 20 atau lebih baru.
- `@luanxdd/snowkit` 3.2.0 atau versi yang kompatibel.
- Endpoint SnowKit: `https://snow.kairogg.com.br`.
- Token SnowKit API yang valid.
- Provider WhatsApp yang mendukung payload Rich Response/HTML.

Konfigurasi:

```env
SNOWKIT_ENDPOINT=https://snow.kairogg.com.br
SNOWKIT_TOKEN=token_anda
```

Token hanya dipakai SDK saat berkomunikasi dengan API. Token tidak perlu dikirim ke WebSocket player karena `socketUrl` yang dikembalikan SnowKit sudah bersifat sementara dan memiliki signature.

## Peran SnowKit SDK

SDK utama dipakai untuk mencari atau resolve lagu:

```ts
import { SnowKit } from "@luanxdd/snowkit"

const snowkit = new SnowKit({
  baseUrl: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

const results = await snowkit.catalog.songs.search("Starboy The Weeknd", {
  market: "BR",
  limit: 1,
})

const song = results.data[0]
```

Modul player SDK menyiapkan sesi playback:

```ts
import { SnowKitPlayer } from "@luanxdd/snowkit/player"

const player = new SnowKitPlayer({
  baseUrl: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

const session = await player.ready(song.id, {
  market: "BR",
})
```

Setelah `ready()` selesai, SDK sudah menyediakan:

- `session.audio.socketUrl` — WebSocket sementara dan signed;
- `session.audio.streamUrl` — HTTP streaming signed dengan dukungan Range;
- `session.audio.contentType`;
- durasi, ukuran, dan hash;
- `session.lyrics.lines` dengan timestamp jika lirik sinkron tersedia.

Paket ini memakai `socketUrl` secara langsung. Tidak ada lagi HTTP client buatan sendiri untuk menyalin route `/v1/player/...`.

## Alur

```text
/player Starboy The Weeknd
        ↓
SnowKit catalog
        ↓
Song
        ↓
SnowKitPlayer.ready(song.id)
        ↓
ReadyPlayerSession
  ├─ socketUrl
  ├─ contentType
  ├─ duration
  └─ lyrics.lines
        ↓
buildPlayerHtml()
        ↓
GenAIaeacdsnwHtmlPrimitive
        ↓
Zapo sendRawMessage() atau Baileys relayMessage()
```

## HTML, CSS, dan JavaScript dipisahkan

- `assets/player.html` berisi struktur.
- `assets/player.css` berisi seluruh styling.
- `assets/player.js` berisi playback, progress bar, seek, WebSocket, dan sinkronisasi lirik.

`PlayerHtml.ts` menggabungkan ketiganya dan menyisipkan data dinamis:

```ts
const html = await buildPlayerHtml({
  title: song.title,
  artist: "The Weeknd, Daft Punk",
  durationMs: session.audio.durationMs,
  socketUrl: session.audio.socketUrl,
  mimeType: session.audio.contentType,
  imageDataUrl: cover,
  lyrics: session.lyrics.lines,
})
```

Cover dikonversi ke `data:image/webp;base64,...` agar Rich HTML tidak terlalu bergantung pada resource eksternal.

## WebSocket

JavaScript membuka `session.audio.socketUrl`. SnowKit mengirim metadata teks, frame audio binary, lalu penanda `[end]`.

Implementasi ini mengumpulkan frame binary, membuat `Blob`, kemudian memasangnya ke elemen `<audio>`. Ini mempertahankan pendekatan Dyno yang sudah bekerja dan menghindari masalah CORS URL audio eksternal di renderer Rich HTML.

Untuk file yang sangat besar, implementasi dapat dikembangkan ke `MediaSource` apabila renderer WhatsApp mendukungnya dengan stabil.

## Mengirim dengan Zapo

```ts
const sender = new ZapoRichHtmlSender(provider)
const player = new SnowKitWhatsAppPlayer(sender, {
  endpoint: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

await player.send(message.chatId, "Starboy The Weeknd", message.keys)
```

Adapter memanggil:

```ts
provider.sendRawMessage(chatId, rawPayload, {
  quote,
})
```

Struktur penting payload:

```text
botForwardedMessage
└─ message
   └─ richResponseMessage
      ├─ submessages
      ├─ unifiedResponse.data
      └─ contextInfo
```

`unifiedResponse.data` adalah JSON yang di-encode Base64. Bagian HTML memakai primitive:

```json
{
  "__typename": "GenAIaeacdsnwHtmlPrimitive",
  "payload": "<html player>",
  "trusted_sources": []
}
```

## Mengirim dengan Baileys

Pada Baileys/fork yang mendukung Rich Response, payload raw yang sama dapat dikirim dengan `relayMessage()`:

```ts
const sender = new BaileysRichHtmlSender(sock)
const player = new SnowKitWhatsAppPlayer(sender, {
  endpoint: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

await player.send(jid, "Starboy The Weeknd")
```

Adapter menjalankan:

```ts
await sock.relayMessage(jid, rawPayload, {})
```

Fork terbaru seperti `@sairidev/baileys` mendokumentasikan Rich Response. Dokumentasi fork lain juga menunjukkan struktur manual `botForwardedMessage > richResponseMessage > unifiedResponse.data`.

### Catatan penting tentang Baileys

Rich HTML bukan API publik WhatsApp. Dukungan bergantung pada proto, versi library, dan versi client WhatsApp. Sebuah fork dapat menerima payload ini sementara versi lain dapat mengabaikannya atau membutuhkan field tambahan.

Karena itu adapter di ZIP ini tidak dikunci ke satu fork tertentu. Yang dibutuhkan hanya objek yang menyediakan `relayMessage()`.

## Instalasi

```bash
pnpm install
pnpm build
```

## Contoh command

```ts
const player = new SnowKitWhatsAppPlayer(
  new ZapoRichHtmlSender(provider),
  {
    endpoint: process.env.SNOWKIT_ENDPOINT ?? "https://snow.kairogg.com.br",
    token: process.env.SNOWKIT_TOKEN!,
    market: "BR",
  },
)

await player.send(message.chatId, args.join(" "), message.keys)
```

## Keamanan

- Jangan pernah memasukkan `SNOWKIT_TOKEN` ke HTML WhatsApp.
- Jangan memasukkan token ke JavaScript player.
- Gunakan hanya `socketUrl`/`streamUrl` signed yang dikembalikan SDK.
- URL sesi player memiliki masa berlaku.
- Jangan menyimpan dan menggunakan kembali `socketUrl` untuk waktu yang tidak terbatas.
- Escape judul, artis, dan teks lain sebelum dimasukkan ke HTML.

## Referensi transport WhatsApp

- `sairidev/baileys-new` — dokumentasi Rich Response terbaru.
- `kyleee-max/casileys` — dokumentasi struktur raw dan primitive HTML.
- Implementasi Dyno yang diberikan pada tugas ini — penggunaan Zapo `sendRawMessage()`.

Struktur Rich HTML bersifat eksperimental dan dapat berubah mengikuti WhatsApp/proto.
