import type { ClientMessage, ServerMessage } from "./protocol.js";

/** Petit wrapper WebSocket pour le mode en ligne. */
export class NetClient {
  private ws: WebSocket | null = null;

  constructor(
    private readonly url: string,
    private readonly handlers: {
      onMessage: (msg: ServerMessage) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: () => void;
    }
  ) {}

  connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.handlers.onOpen?.();
    this.ws.onclose = () => this.handlers.onClose?.();
    this.ws.onerror = () => this.handlers.onError?.();
    this.ws.onmessage = (ev) => {
      try {
        this.handlers.onMessage(JSON.parse(ev.data) as ServerMessage);
      } catch {
        /* message ignoré */
      }
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
