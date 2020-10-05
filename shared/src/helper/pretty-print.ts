export const prettyPrint = (o: any): string =>
  JSON.stringify(o, (_, v) => (v.toFixed ? Number(v.toFixed(3)) : v), '  ')
    .replace(/("|,|{|^\n)/g, '')
    .replace(/(\W*}\n?)+/g, '\n\n');
