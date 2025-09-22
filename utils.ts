// utils.ts
export const flow = (...fns: Function[]) => (x: any) => fns.reduce((v, f) => f(v), x);
