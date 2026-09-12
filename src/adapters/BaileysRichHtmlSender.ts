import { createRichHtmlPayload, type RichHtmlOptions } from "../rich/RichHtmlPayload.js"

export interface BaileysLikeSocket {
  relayMessage(jid: string, message: unknown, options?: Record<string, unknown>): Promise<unknown>
}

export class BaileysRichHtmlSender {
  readonly #socket: BaileysLikeSocket

  constructor(socket: BaileysLikeSocket) {
    this.#socket = socket
  }

  send(jid: string, options: RichHtmlOptions): Promise<unknown> {
    return this.#socket.relayMessage(jid, createRichHtmlPayload(options), {})
  }
}
