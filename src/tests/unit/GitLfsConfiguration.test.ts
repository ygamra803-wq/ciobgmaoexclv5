import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Git Binary Files & Ignore Configuration (P2-1)', () => {
  it('should have .gitattributes file configured with standard binary markers in repository root', () => {
    const gitattributesPath = path.resolve(process.cwd(), '.gitattributes');
    expect(fs.existsSync(gitattributesPath)).toBe(true);

    const content = fs.readFileSync(gitattributesPath, 'utf-8');

    // Check Excel spreadsheet binary tracking (without requiring git-lfs binary)
    expect(content).toContain('*.xlsx binary');
    expect(content).toContain('*.xls binary');
    expect(content).toContain('*.xlsm binary');
    expect(content).toContain('*.xlsb binary');

    // Check Binary Archives & Assets tracking
    expect(content).toContain('*.zip binary');
    expect(content).toContain('*.pdf binary');
    expect(content).toContain('*.png binary');
  });

  it('should have .gitignore properly excluding local temporary envs, runtime state, and lock conflicts without ignoring src/data/ seeds', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.env.local');
    expect(content).toContain('.env.production.local');
    expect(content).toContain('dist/');
    expect(content).toContain('node_modules/');
    expect(content).toContain('/data/');
    expect(content).toContain('/data/gmao_state.json');
    expect(content).toContain('!/src/data/');

    // Ensure no unanchored 'data/' line exists that would accidentally ignore 'src/data/'
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    expect(lines).not.toContain('data/');

    // Verify src/data seed files exist on disk
    const seedStockPath = path.resolve(process.cwd(), 'src/data/stock/seedStockItems.json');
    const seedPreventivePath = path.resolve(process.cwd(), 'src/data/preventive/seedPreventiveTasks.json');
    expect(fs.existsSync(seedStockPath)).toBe(true);
    expect(fs.existsSync(seedPreventivePath)).toBe(true);
  });
});
