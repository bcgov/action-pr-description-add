import { error, getInput, info } from '@actions/core'
import { context, getOctokit } from '@actions/github'

// Action input
const markdown = getInput('add_markdown')
const token = getInput('github_token')

if (!markdown || !token) {
  error('Error: please verify input!')
}

/**
 * Normalizes text for comparison by trimming and normalizing whitespace
 * This helps detect duplicates even with minor whitespace differences
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd()) // Trim trailing whitespace from each line
    .join('\n')
    .trim() // Trim leading/trailing whitespace from entire block
}

/**
 * Removes checkbox markdown syntax from text for comparison purposes.
 * This treats checkbox state changes (- [ ] to - [x]) as expected body mutations
 * that shouldn't trigger duplicate detection.
 */
function removeCheckboxes(text: string): string {
  return text
    .replace(/^-? \[ \] .*$/gm, '') // Unchecked: "- [ ] text" or "[ ] text"
    .replace(/^-? \[x\] .*/gim, '') // Checked: "- [x] text" or "[x] text" (with optional hyphen)
    .replace(/^\s*$/gm, '') // Remove empty lines left by removed checkboxes
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple blank lines
    .trim()
}

// Main function
async function action(): Promise<void> {
  // Ensure pull request exists
  if (!context.payload.pull_request) {
    error('Error: No pull request found in context. Exiting.')
    return
  }

  const prNumber = context.payload.pull_request.number
  const octokit = getOctokit(token)

  // Fetch latest PR body from API to avoid race conditions
  let currentBody = ''
  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber
    })
    currentBody = pr.body || ''
  } catch (err) {
    // Fallback to context if API call fails
    error(
      `Failed to fetch PR from API: ${err instanceof Error ? err.message : err}`
    )
    currentBody = context.payload.pull_request?.body || ''
    info('Fell back to context PR body.')
  }

  // Check if markdown is already present using normalized comparison
  // Exclude checkbox state from comparison since clicking checkboxes is an expected body change
  const normalizedBody = normalizeText(currentBody)
  const normalizedMarkdown = normalizeText(markdown)
  const bodyForComparison = removeCheckboxes(normalizedBody)
  const markdownForComparison = removeCheckboxes(normalizedMarkdown)

  if (bodyForComparison.includes(markdownForComparison)) {
    info('Markdown message is already present (excluding checkbox state). Exiting.')
    return
  }

  // Append markdown
  const updatedBody = currentBody
    ? `${currentBody.trim()}\n\n${markdown}`
    : markdown

  // Update PR body
  info('Description is being updated.')
  try {
    await octokit.rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      body: updatedBody
    })
    info('Successfully updated PR description.')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const statusCode = (err as { status?: number })?.status

    // Handle specific error cases
    if (statusCode === 404) {
      error('PR not found. It may have been deleted.')
    } else if (statusCode === 403) {
      error('Permission denied. Check token permissions.')
    } else {
      error(`Failed to update PR: ${errorMessage}`)
    }
    throw err
  }
}

// Run main function
; (async () => {
  try {
    await action()
  } catch (err) {
    error(`Unexpected error: ${err instanceof Error ? err.message : err}`)
  }
})()
