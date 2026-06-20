import fs from 'fs';
import path from 'path';
import { glob } from 'tinyglobby';
import { spawnSync } from 'child_process';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';

export function promptClaudeCli(prompt: string, claudeArgs: string[] = []): string {
  const result = spawnSync('claude', ['-p', prompt, ...claudeArgs], { encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(result.stderr || `claude exited ${result.status}`);
  return result.stdout.trim();
}

export async function promptClaudeApi(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);
  return block.text;
}

export async function promptClaudeApiParams(params: Anthropic.MessageCreateParamsNonStreaming): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create(params);
  const block = response.content[0];
  if (block.type !== 'text') throw new Error(`Unexpected response type: ${block.type}`);
  return block.text;
}

export interface AstroSlopSpawnerSetting { globString: string, pipes: AstroSlopSpawnerPipes, output: string }
export type AstroSlopSpawnerSettings = AstroSlopSpawnerSetting | AstroSlopSpawnerSetting[]
export type AstroSlopSpawnerPipes = { to?: string, map: Function }[]

export default function AstroSlopSpawner(settings: AstroSlopSpawnerSettings): AstroIntegration {
  return {
    name: "astro-slop-spawner",
    hooks: {
      "astro:build:start": async ({ logger }) => {
        if (!(settings instanceof Array)) {
          settings = [settings]
        }
        for (let setting of settings) {
          await slopLoader(setting.globString, setting.pipes, setting.output, logger)
        }
        logger.info("Finished generating slop!")
      }
    }
  }
}

async function slopLoader(globString: string | string[], pipes: AstroSlopSpawnerPipes, output: string, logger: AstroIntegrationLogger) {
  function setPath(obj: Record<string, any>, dotPath: string, value: any) {
    const keys = dotPath.split('.');
    let cur = obj;
    for (const key of keys.slice(0, -1)) {
      cur[key] ??= {};
      cur = cur[key];
    }
    cur[keys.at(-1)!] = value;
  }

  const files = await glob(globString)
  for (const file of files) {
    logger.debug(`Reading file: [${file}]...`)
    const raw = fs.readFileSync(file, 'utf-8');
    const outputDir = path.join(process.cwd(), output)
    const outputPath = path.join(outputDir, path.basename(file))
    if (fs.existsSync(outputPath)) {
      logger.info(`Skipping file [${file}], output file already exists in [${output}]!`)
      continue
    }
    const inputFrontmatter = matter(raw)
    const outputFrontmatter = matter(raw)
    for (const pipe of pipes) {
      try {
        if (typeof(pipe.to) !== "undefined") {
          setPath(outputFrontmatter, pipe.to, await pipe.map(inputFrontmatter))
        }
        else {
          await pipe.map(inputFrontmatter)
        }
      }
      catch (e) {
        logger.error(`Couldn't set the value of ${pipe.to} from file ${file}. Error: ${(e as Error).toString()}`)
      }
    }
    logger.debug(`Writing to file: [${outputPath}]...`)
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, matter.stringify(outputFrontmatter.content, outputFrontmatter.data))
  }
}
