import matter from 'gray-matter';
import { marked } from 'marked';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DailyNote {
  date: string;
  title: string;
  content: string;
  html: string;
  summary: string[];
  filename: string;
}

export interface MemoryEntry {
  title: string;
  href: string;
  description: string;
}

const WORKSPACE_DIR = path.resolve(process.cwd(), '..');

function extractSummaryItems(content: string): string[] {
  const lines = content.split('\n');
  const items: string[] = [];
  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items.slice(0, 5);
}

export function getDailyNotes(): DailyNote[] {
  const memoryDir = path.join(WORKSPACE_DIR, 'memory');
  if (!fs.existsSync(memoryDir)) return [];

  const files = fs.readdirSync(memoryDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  return files.map(filename => {
    const raw = fs.readFileSync(path.join(memoryDir, filename), 'utf-8');
    const { data, content } = matter(raw);
    const date = filename.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = data.title || titleMatch?.[1] || date;

    return {
      date,
      title,
      content,
      html: marked.parse(content, { async: false }) as string,
      summary: extractSummaryItems(content),
      filename,
    };
  });
}

export function getMemoryIndex(): { html: string; entries: MemoryEntry[] } {
  const memoryPath = path.join(WORKSPACE_DIR, 'MEMORY.md');
  if (!fs.existsSync(memoryPath)) {
    return { html: '<p>MEMORY.md not found</p>', entries: [] };
  }

  const raw = fs.readFileSync(memoryPath, 'utf-8');
  const html = marked.parse(raw, { async: false }) as string;

  const entries: MemoryEntry[] = [];
  for (const line of raw.split('\n')) {
    const match = line.match(/^-\s+\[(.+?)\]\((.+?)\)\s*[—–-]\s*(.+)/);
    if (match) {
      entries.push({ title: match[1], href: match[2], description: match[3] });
    }
  }

  return { html, entries };
}

export interface Stats {
  totalDays: number;
  totalMemories: number;
  currentStreak: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function getStats(notes: DailyNote[]): Stats {
  if (notes.length === 0) {
    return { totalDays: 0, totalMemories: 0, currentStreak: 0, firstDate: null, lastDate: null };
  }

  const memoryDir = path.join(WORKSPACE_DIR, 'memory');
  const allFiles = fs.existsSync(memoryDir) ? fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')) : [];

  // Calculate streak from most recent date
  const dates = notes.map(n => n.date).sort().reverse();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1) {
      streak++;
    } else {
      break;
    }
  }

  return {
    totalDays: notes.length,
    totalMemories: allFiles.length,
    currentStreak: streak,
    firstDate: dates[dates.length - 1],
    lastDate: dates[0],
  };
}
