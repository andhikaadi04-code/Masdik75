# SnowKit WhatsApp Player

Pacote isolado do `/player` do Dyno, reorganizado para usar a SnowKit SDK como única camada de acesso à SnowKit API.

## O que este ZIP contém

```text
assets/
  player.html        estrutura do player
  player.css         visual do player
  player.js          reprodução, progresso e lyrics sincronizadas
src/
  snowkit/
    SnowKitClient.ts integração com @luanxdd/snowkit
  player/
    Artwork.ts       transforma a capa em data URL para o Rich HTML
    PlayerHtml.ts    combina HTML + CSS + JS + dados da sessão
    SnowKitWhatsAppPlayer.ts fluxo completo do player
  rich/
    RichHtmlPayload.ts payload raw do Rich HTML do WhatsApp
  adapters/
    ZapoRichHtmlSender.ts
    BaileysRichHtmlSender.ts
examples/
  zapo.ts
  baileys.ts
```

## Requisitos

- Node.js 20 ou superior.
- `@luanxdd/snowkit` 3.2.0 ou compatível.
- Endpoint SnowKit: `https://snow.kairogg.com.br`.
- Token válido da SnowKit API.
- Um provider WhatsApp compatível com o payload de Rich Response/HTML.

Configure:

```env
SNOWKIT_ENDPOINT=https://snow.kairogg.com.br
SNOWKIT_TOKEN=seu_token
```

O token é usado pela SDK ao falar com a API. Ele não precisa ser colocado no WebSocket do player: `socketUrl` já é uma URL temporária e assinada retornada pela SnowKit.

## Como a SnowKit SDK entra no player

Existem duas partes da SDK usadas aqui.

A API principal resolve a música:

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

O módulo de player prepara a reprodução:

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

Quando `ready()` termina, a SDK já entrega:

- `session.audio.socketUrl` — WebSocket temporário e assinado;
- `session.audio.streamUrl` — streaming HTTP assinado com Range;
- `session.audio.contentType`;
- duração, tamanho e hash;
- `session.lyrics.lines` com timestamps quando houver lyrics sincronizadas.

Este pacote usa `socketUrl` diretamente. Não existe mais um cliente HTTP próprio copiando as rotas `/v1/player/...`.

## Fluxo completo

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
Zapo sendRawMessage() ou Baileys relayMessage()
```

## HTML, CSS e JavaScript separados

O HTML está em `assets/player.html`, o CSS em `assets/player.css` e a lógica em `assets/player.js`.

`PlayerHtml.ts` lê os três arquivos e injeta apenas os dados dinâmicos da faixa:

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

A capa é convertida para `data:image/webp;base64,...` antes de entrar no Rich HTML. Isso reduz a dependência de recursos externos dentro do renderer do WhatsApp.

## WebSocket

O JavaScript abre `session.audio.socketUrl` e recebe os bytes de áudio enviados pelo endpoint assinado da SnowKit.

A SDK/API envia primeiro metadata textual e depois frames binários de áudio, finalizando com `[end]`.

O player deste ZIP acumula os frames em memória, cria um `Blob` e entrega esse blob ao elemento `<audio>`. Isso reproduz a estratégia que estava funcionando no Dyno e evita depender de CORS de uma URL externa dentro do Rich HTML.

Para arquivos muito grandes, vale evoluir isso para `MediaSource` quando o renderer do cliente suportar de forma confiável.

## Envio com Zapo

O Dyno usa a camada raw do provider. O adapter está em `src/adapters/ZapoRichHtmlSender.ts`.

Uso:

```ts
const sender = new ZapoRichHtmlSender(provider)
const player = new SnowKitWhatsAppPlayer(sender, {
  endpoint: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

await player.send(message.chatId, "Starboy The Weeknd", message.keys)
```

Por baixo, o adapter chama:

```ts
provider.sendRawMessage(chatId, rawPayload, {
  quote,
})
```

O `rawPayload` contém:

```text
botForwardedMessage
└─ message
   └─ richResponseMessage
      ├─ submessages
      ├─ unifiedResponse.data
      └─ contextInfo
```

`unifiedResponse.data` é JSON convertido para Base64. Dentro dele, a seção usa:

```json
{
  "__typename": "GenAIaeacdsnwHtmlPrimitive",
  "payload": "<html do player>",
  "trusted_sources": []
}
```

## Envio com Baileys

No Baileys/forks compatíveis com Rich Response, o mesmo payload pode ser enviado via `relayMessage`:

```ts
const sender = new BaileysRichHtmlSender(sock)
const player = new SnowKitWhatsAppPlayer(sender, {
  endpoint: "https://snow.kairogg.com.br",
  token: process.env.SNOWKIT_TOKEN!,
})

await player.send(jid, "Starboy The Weeknd")
```

O adapter faz essencialmente:

```ts
await sock.relayMessage(jid, rawPayload, {})
```

Forks recentes como `@sairidev/baileys` documentam suporte a Rich Response. Outros forks também mostram a montagem manual de `botForwardedMessage > richResponseMessage > unifiedResponse.data`.

### Aviso importante sobre Baileys

Rich HTML não é uma API pública/documentada do WhatsApp. O suporte depende do proto e do comportamento do cliente WhatsApp. A biblioteca oficial/fork que você usar pode aceitar o payload raw, ignorá-lo ou exigir campos adicionais em determinada versão.

Por isso o ZIP não amarra o adapter a um fork específico: ele exige apenas um objeto com `relayMessage()`.

## Payload Rich HTML

A montagem central fica em `src/rich/RichHtmlPayload.ts` e é compartilhada pelos dois adapters.

Isso evita manter uma versão do payload para Zapo e outra para Baileys.

## Instalação

```bash
pnpm install
pnpm build
```

## Exemplo de integração em um comando

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

## Segurança

- Nunca coloque `SNOWKIT_TOKEN` no HTML enviado ao WhatsApp.
- Nunca coloque o token no JavaScript do player.
- Use somente `socketUrl`/`streamUrl` assinados retornados pela SDK.
- As URLs do player expiram; gere uma nova sessão quando necessário.
- Não reutilize indefinidamente um `socketUrl` salvo em banco ou cache.
- Valide e escape título, artista e qualquer texto inserido no HTML.

## Fontes consultadas para o transporte WhatsApp

- `sairidev/baileys-new` — documentação recente de Rich Response e suporte a tipos adicionais.
- `kyleee-max/casileys` — documentação da estrutura raw `botForwardedMessage > richResponseMessage > unifiedResponse.data` e do primitive HTML.
- Código original do Dyno enviado junto desta tarefa — implementação Zapo com `sendRawMessage()`.

A estrutura é experimental e pode mudar junto com o WhatsApp/proto.
