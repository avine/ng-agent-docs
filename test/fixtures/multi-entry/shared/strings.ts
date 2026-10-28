// Not an entry point: this folder has no ng-package.json.

/** Capitalizes the first letter. Declared outside the folder of the entry point that exports it. */
export const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
