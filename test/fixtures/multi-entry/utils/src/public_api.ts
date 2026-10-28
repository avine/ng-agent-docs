/** Small helpers. Uses ng-packagr's default entry file: src/public_api.ts. @packageDocumentation */
export * from '../../shared/strings';
// Default export: not documented, the generator must warn.
export { capitalize as default } from '../../shared/strings';
// Unresolvable export: the generator must warn. (@ts-ignore keeps the fixture type-checking.)
// @ts-ignore
export { missingHelper } from './missing-helper';
