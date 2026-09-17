import { CARDS } from "../engine/cards.js";
import { CARD_ORDER } from "../engine/cards.js";

/** Interface joueur : chrono, jauge d'élixir et barre de cartes (DOM au-dessus du canvas). */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly timerEl: HTMLDivElement;
  private readonly elixirFill: HTMLDivElement;
  private readonly elixirText: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private selected: string | null = null;

  constructor(private readonly onSelect: (cardId: string | null) => void) {
    this.root = document.createElement("div");
    this.root.style.cssText =
      "position:absolute;left:0;right:0;bottom:0;top:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;";

    // Chrono (haut)
    this.timerEl = document.createElement("div");
    this.timerEl.style.cssText =
      "align-self:center;margin-top:8px;background:rgba(0,0,0,.5);color:#fff;padding:4px 14px;border-radius:20px;font-weight:bold;font-variant-numeric:tabular-nums;";
    this.root.appendChild(this.timerEl);

    // Bloc du bas : élixir + cartes
    const bottom = document.createElement("div");
    bottom.style.cssText = "pointer-events:auto;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,.55));";

    const elixirWrap = document.createElement("div");
    elixirWrap.style.cssText = "position:relative;height:18px;border-radius:9px;background:#2a1a3a;overflow:hidden;margin-bottom:8px;";
    this.elixirFill = document.createElement("div");
    this.elixirFill.style.cssText = "position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#c026d3,#e879f9);width:50%;transition:width .1s linear;";
    this.elixirText = document.createElement("div");
    this.elixirText.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;";
    elixirWrap.appendChild(this.elixirFill);
    elixirWrap.appendChild(this.elixirText);
    bottom.appendChild(elixirWrap);

    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:6px;justify-content:center;flex-wrap:wrap;";
    for (const id of CARD_ORDER) {
      const card = CARDS[id];
      const btn = document.createElement("button");
      btn.textContent = `${card.name}\n${card.cost}⚡`;
      btn.style.cssText =
        "white-space:pre;pointer-events:auto;min-width:64px;padding:8px 6px;border-radius:8px;border:2px solid #333;background:#1f2733;color:#fff;font-size:12px;cursor:pointer;line-height:1.3;";
      btn.onclick = () => this.select(id);
      this.buttons.set(id, btn);
      bar.appendChild(btn);
    }
    bottom.appendChild(bar);
    this.root.appendChild(bottom);
  }

  private select(id: string): void {
    this.selected = this.selected === id ? null : id;
    for (const [cid, btn] of this.buttons) {
      btn.style.borderColor = cid === this.selected ? "#e879f9" : "#333";
    }
    this.onSelect(this.selected);
  }

  clearSelection(): void {
    this.selected = null;
    for (const btn of this.buttons.values()) btn.style.borderColor = "#333";
    this.onSelect(null);
  }

  getSelected(): string | null {
    return this.selected;
  }

  update(elixir: number, timeLeftS: number): void {
    this.elixirFill.style.width = `${(elixir / 10) * 100}%`;
    this.elixirText.textContent = `${Math.floor(elixir)} / 10`;
    const m = Math.floor(timeLeftS / 60);
    const s = Math.floor(timeLeftS % 60);
    this.timerEl.textContent = `⏱ ${m}:${s.toString().padStart(2, "0")}`;
    for (const [id, btn] of this.buttons) {
      const affordable = elixir >= CARDS[id].cost;
      btn.style.opacity = affordable ? "1" : "0.45";
    }
  }
}
