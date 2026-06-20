### astro-slop-spawner
A simple, small and flexible Astro Integration to help you transform your frontmatter content with Claude. Take a base file, overwrite its content and data with pipes and save it in a new location during build start.

If an output file for the file already exists, the pipeline for the file will be skipped.

Inspired by other Astro LLM integrations - what sets this one apart is support for CLI (to save your money) and the general flexibility. You can use the Claude functions here by themselves, use the pipes without any AI support or write your custom AI logic.

### Example
In `astro.config.ts`:
```typescript
import AstroSlopSpawner, { promptClaudeApi, promptClaudeCli } from 'astro-slop-spawner';

type GrayMatterDict = { "content": string, "data": Record<string, any> }

export default defineConfig({
    integrations: [
        AstroSlopSpawner(
		[{
		globString: 'source/**/*.md',
		pipes: [
			{ to: 'data.summary', map: (e: GrayMatterDict) => promptClaudeCli(`Write a short summary (up to 20 words) based on the content content: ${e.content}\n\n\nReturn only the text summary!`) },
		],
		output: 'src/content/blog/',
		}
		,{
		globString: 'src/content/blog/*.md',
		pipes: [
			{ to: 'content', map: (e: GrayMatterDict) => promptClaudeCli(`Translate this English article to Polish. This is a Markdown file, so remember to preserve the formatting. Do not change links, shell commands, original names or any other things important for understanding this article. Return the Polish text only.\n---\n${e.content}`) },
			{ to: 'data.title', map: (e: GrayMatterDict) => promptClaudeCli(`Translate this English title to Polish. Return the Polish text only.\n---\n${e.data.title}`) },
			{ to: 'data.summary', map: (e: GrayMatterDict) => promptClaudeApi(`Translate this English summary to Polish. Return the Polish text only.\n---\n${e.data.summary}`) },
			{ map: (e: GrayMatterDict) => {
					e.language = "pl";
					e.ai_generated = true;
				}
			},
			{ to: 'data.translated_at', map: (_: GrayMatterDict) => new Date().toString() },
		],
		output: 'src/content/blog/pl',
		}]
		)
	]
})
```
In this example we will create a new file with a summary and then create a Polish translation of the newly created file.

Requires the `ANTHROPIC_API_KEY` environmental variable for API calls and `claude` command in PATH for CLI calls.

### Claude functions
`function promptClaudeCli(prompt: string, claudeArgs: string[] = []): string`

`async function promptClaudeApi(prompt: string): Promise<string>`

`async function promptClaudeApiParams(params: Anthropic.MessageCreateParamsNonStreaming): Promise<string>`
