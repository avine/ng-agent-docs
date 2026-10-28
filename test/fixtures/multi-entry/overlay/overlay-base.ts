/** Base class of the overlays. Abstract class, without an Angular decorator. */
export abstract class FxOverlayBase {
  /** Attaches the overlay to the page. */
  abstract attach(): void;

  /** Detaches the overlay from the page. */
  detach(): void {}
}
