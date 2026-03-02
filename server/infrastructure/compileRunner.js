import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { parseLatexErrors } from '../domain/validation.js';

let hasLatexmk = null;
function checkLatexmk() {
  if (hasLatexmk !== null) return hasLatexmk;
  try {
    execSync('which latexmk', { stdio: 'ignore' });
    hasLatexmk = true;
  } catch {
    hasLatexmk = false;
  }
  return hasLatexmk;
}

function runCommand(cmd, args, cwd, env, timeoutSec) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, env, shell: false });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d;
    });
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr: stderr + '\nCompilation timeout.' });
    }, timeoutSec * 1000);
    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        resolve({ code: -1, stdout: '', stderr: `${cmd} not installed. Install TeX Live or MiKTeX.` });
      } else {
        resolve({ code: -1, stdout: '', stderr: String(err) });
      }
    });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function runDocker(projectRoot, mainFile, compiler, timeoutSec) {
  const root = path.resolve(projectRoot);
  const cmd = ['pdflatex', 'xelatex', 'lualatex'].includes(compiler) ? compiler : 'pdflatex';
  const engineFlag = cmd === 'pdflatex' ? '-pdf' : cmd === 'xelatex' ? '-xelatex' : '-lualatex';
  const latexmkArgs = [engineFlag, '-interaction=nonstopmode', '-halt-on-error', '-outdir=/work', mainFile];
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${root}:/work`,
    '-w',
    '/work',
    '--network',
    'none',
    config.dockerTexImage,
    'latexmk',
    ...latexmkArgs,
  ];
  return runCommand('docker', dockerArgs, process.cwd(), { ...process.env, TEXINPUTS: '/work//:' }, timeoutSec);
}

const VALID_COMPILERS = new Set(['pdflatex', 'xelatex', 'lualatex']);

/** .bib: latexmk runs bibtex/biber automatically; fallback (no latexmk) runs bibtex when a .bib file exists in project root. */
export async function run(projectRoot, mainFile, compiler = 'pdflatex') {
  const root = path.resolve(projectRoot);
  const mainPath = path.join(root, mainFile);
  if (!fs.existsSync(mainPath)) {
    return { success: false, log: '', errors: [{ message: `File ${mainFile} not found` }] };
  }

  const pdfName = path.basename(mainFile, path.extname(mainFile)) + '.pdf';
  const pdfPath = path.join(root, pdfName);
  
  if (fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath);
    } catch {
      // ignore if cannot delete
    }
  }

  const cmd = VALID_COMPILERS.has(compiler) ? compiler : 'pdflatex';
  const env = { ...process.env, TEXINPUTS: root + '//:' };
  let result;

  if (config.useDockerCompile) {
    result = await runDocker(root, mainFile, cmd, config.compileTimeoutSeconds);
  } else if (checkLatexmk()) {
    const engineFlag = cmd === 'pdflatex' ? '-pdf' : cmd === 'xelatex' ? '-xelatex' : '-lualatex';
    result = await runCommand(
      'latexmk',
      [engineFlag, '-interaction=nonstopmode', '-halt-on-error', '-outdir=' + root, mainFile],
      root,
      env,
      config.compileTimeoutSeconds,
    );
  } else {
    result = await runCommand(
      cmd,
      ['-synctex=1', '-interaction=nonstopmode', '-halt-on-error', mainFile],
      root,
      env,
      config.compileTimeoutSeconds,
    );
    if (result.code === 0) {
      const hasBib = fs.readdirSync(root).some((f) => f.endsWith('.bib'));
      if (hasBib) {
        await runCommand(
          'bibtex',
          [path.basename(mainFile, path.extname(mainFile))],
          root,
          env,
          config.compileTimeoutSeconds,
        );
      }
      await runCommand(
        cmd,
        ['-synctex=1', '-interaction=nonstopmode', mainFile],
        root,
        env,
        config.compileTimeoutSeconds,
      );
    }
  }

  const log = result.stdout + '\n' + result.stderr;
  const errors = parseLatexErrors(log);
  const pdfExists = fs.existsSync(pdfPath);
  const hasWarnings = result.code !== 0 && pdfExists;

  return { success: pdfExists, log, errors, hasWarnings };
}
