export const DEBUG = false; // Set to true when debugging

export function log(...args) {
  if (DEBUG) // console.log(...args);
}

export function error(...args) {
  console.error(...args); // Always show errors
}
