import { parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const text = 'id,name\n1,Ada\n2,Eda';
    expect(parseCsv(text)).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Eda' },
    ]);
  });

  it('handles quoted values containing commas', () => {
    const text = 'id,name\n1,"Lovelace, Ada"';
    expect(parseCsv(text)).toEqual([{ id: '1', name: 'Lovelace, Ada' }]);
  });

  it('handles escaped quotes', () => {
    const text = 'id,name\n1,"She said ""hi"""';
    expect(parseCsv(text)).toEqual([{ id: '1', name: 'She said "hi"' }]);
  });

  it('strips UTF-8 BOM', () => {
    const text = '﻿id,name\n1,Ada';
    expect(parseCsv(text)).toEqual([{ id: '1', name: 'Ada' }]);
  });

  it('handles CRLF line endings', () => {
    const text = 'id,name\r\n1,Ada\r\n2,Eda';
    expect(parseCsv(text)).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Eda' },
    ]);
  });

  it('respects newlines inside quoted fields', () => {
    const text = 'id,name\n1,"line1\nline2"';
    expect(parseCsv(text)).toEqual([{ id: '1', name: 'line1\nline2' }]);
  });
});
