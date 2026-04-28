import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeToHtml } from 'shiki';
import LedgerWorkspace from './_components/LedgerWorkspace';

export default async function LedgerPage() {
  const sql = await readFile(path.resolve(process.cwd(), 'drizzle/0000_init.sql'), 'utf8');
  const html = await codeToHtml(sql, {
    lang: 'sql',
    themes: { light: 'github-light', dark: 'github-dark' },
  });
  return <LedgerWorkspace howItWorksHtml={html} />;
}
