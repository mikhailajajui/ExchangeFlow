/** Stand-in for the prototype backend in normal builds (aliased as "@desk-local"); never called because PROTOTYPE is false. */
export const getConfig = (): never => { throw new Error('prototype backend not in this build'); };
export const getQuote = getConfig;
export const checkRequest = getConfig;
