# FxLiveAnnouncer (service)

`import { FxLiveAnnouncer } from '@fixtures/single-entry';`

providedIn: 'root'

Announces messages to screen readers. Its public properties are constructor parameters.

## Properties
- `readonly injector: Injector` — constructor parameter
- `readonly zone: NgZone` — constructor parameter

## Methods
- `announce(message: string): void` — Announces a message.
