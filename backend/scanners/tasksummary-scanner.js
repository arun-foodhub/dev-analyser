const fs = require('fs');
const path = require('path');

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function parseSummary(filename, content) {
  const numMatch = filename.match(/^(\d+)-/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 999;
  const slug = filename.replace(/\.md$/, '');

  let title = '';
  let date = '';
  let status = '';
  let preview = '';
  let taskType = '';

  // Pattern 1: "# Task Summary: <Title>" — has structured metadata
  const taskSummaryMatch = content.match(/^# Task Summary:\s*(.+)/m);
  if (taskSummaryMatch) {
    title = taskSummaryMatch[1].trim();
    const dateMatch = content.match(/\*\*Date\*\*[:\s]+([^\n*]+)/);
    if (dateMatch) date = dateMatch[1].trim();
    const statusMatch = content.match(/\*\*Status\*\*[:\s]+([^\n*]+)/);
    if (statusMatch) status = statusMatch[1].trim();
    const taskTypeMatch = content.match(/\*\*Task Type\*\*[:\s]+([^\n*]+)/);
    if (taskTypeMatch) taskType = taskTypeMatch[1].trim();
  } else {
    // Pattern 2: filename as H1, real title in H2
    const filenameH1Match = content.match(/^# .+\.md\s*\n+## (.+)/m);
    if (filenameH1Match) {
      title = filenameH1Match[1].trim();
    } else {
      // Pattern 3: Plain H1 or "# <number> - <title>"
      const h1Match = content.match(/^# (.+)/m);
      if (h1Match) {
        title = h1Match[1].replace(/^\d+\s*-\s*/, '').trim();
      }
    }
  }

  // Fallback title from filename
  if (!title) {
    title = slug.replace(/^\d+-/, '').replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Extract preview: first non-empty paragraph after heading + metadata
  // Strip headings, bold metadata lines, empty lines from top, grab first real text
  const lines = content.split('\n');
  const previewLines = [];
  let pastMeta = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { if (pastMeta && previewLines.length) break; continue; }
    if (trimmed.startsWith('#')) { pastMeta = true; continue; }
    if (trimmed.startsWith('**') && trimmed.includes(':**')) { pastMeta = true; continue; }
    if (trimmed.startsWith('---')) continue;
    if (pastMeta || previewLines.length === 0) {
      pastMeta = true;
      previewLines.push(trimmed);
      if (previewLines.join(' ').length > 200) break;
    }
  }
  preview = previewLines.join(' ').slice(0, 250);
  if (preview.length === 250) preview += '…';

  // Normalize status emoji
  let statusClass = 'neutral';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('complet') || status.includes('✅')) statusClass = 'completed';
  else if (statusLower.includes('progress') || status.includes('🔄')) statusClass = 'in-progress';
  else if (statusLower.includes('fail') || status.includes('❌')) statusClass = 'failed';

  return { num, slug, filename, title, date, status, statusClass, taskType, preview };
}

function scanTaskSummaries(repos) {
  const repoConfig = repos.find(r => r.name === 'foodhubglobal');
  if (!repoConfig || !fs.existsSync(repoConfig.localPath)) {
    return { tasks: [], total: 0, lastScanned: new Date().toISOString() };
  }

  const summaryDir = path.join(repoConfig.localPath, 'tasksummary');
  if (!fs.existsSync(summaryDir)) {
    return { tasks: [], total: 0, lastScanned: new Date().toISOString() };
  }

  let files;
  try {
    files = fs.readdirSync(summaryDir)
      .filter(f => f.endsWith('.md') && f !== 'README.md' && /^\d+/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
        const nb = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
        return na - nb;
      });
  } catch { return { tasks: [], total: 0, lastScanned: new Date().toISOString() }; }

  const tasks = files.map(filename => {
    const content = readFileSafe(path.join(summaryDir, filename)) || '';
    return parseSummary(filename, content);
  });

  return {
    tasks,
    total: tasks.length,
    lastScanned: new Date().toISOString(),
  };
}

module.exports = { scanTaskSummaries };
