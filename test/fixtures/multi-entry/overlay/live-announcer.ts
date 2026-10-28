import { Injectable, Injector, NgZone } from '@angular/core';

/** Announces messages to screen readers. Its public properties are constructor parameters. */
@Injectable({ providedIn: 'root' })
export class FxLiveAnnouncer {
  constructor(
    public readonly injector: Injector,
    readonly zone: NgZone, // `readonly` alone: a public property too
    private readonly secret: string,
    protected readonly hidden: number,
    plain: boolean, // not a property
  ) {}

  /** Announces a message. */
  announce(message: string): void {}
}
