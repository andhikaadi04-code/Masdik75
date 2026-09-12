import { BaileysRichHtmlSender, SnowKitWhatsAppPlayer } from "../src/index.js"

export async function sendWithBaileys(sock: unknown, jid: string, input: string) {
  const sender = new BaileysRichHtmlSender(sock as ConstructorParameters<typeof BaileysRichHtmlSender>[0])
  const player = new SnowKitWhatsAppPlayer(sender, {
    endpoint: process.env.SNOWKIT_ENDPOINT ?? "https://snow.kairogg.com.br",
    token: process.env.SNOWKIT_TOKEN!,
    market: "BR",
  })

  await player.send(jid, input)
}
