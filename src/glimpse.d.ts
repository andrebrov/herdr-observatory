declare module "glimpseui" {
  import { EventEmitter } from "node:events";
  interface Window extends EventEmitter {
    send(js: string): void;
    close(): void;
    setHTML(html: string): void;
  }
  export function open(
    html: string,
    options: { width: number; height: number; title: string },
  ): Window;
}
