/** Quoted PostgREST literals cannot add extra OR predicates. */
export function searchPattern(term: string): string {
  const literal = term.replace(/[%_]/g, "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${literal}%"`;
}

export function safeCsvCell(value: string): string {
  const text = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}