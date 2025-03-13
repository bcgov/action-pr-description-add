import {error, getInput, info} from '@actions/core'
import {context, getOctokit} from '@actions/github'

// Action input
const markdown = getInput('add_markdown')
const token = getInput('github_token')

if (!markdown || !token) {
  error('Error: please verify input!')
}

// Main function
async function action(): Promise<void> {
  // Ensure pull request exists
  if (!context.payload.pull_request) {
    error('Error: No pull request found in context. Exiting.')
    return
  }

  // Get PR body from GitHub context
  const body = context.payload.pull_request?.body || ''

  // If message is already present, then return/exit
  if (body.includes(markdown)) {
    info('Markdown message is already present. Exiting.')
    return
  }

  // Append markdown after removing existing duplicates
  const updatedBody = `${body
    .split('\n')
    .filter(line => line.trim() !== markdown.trim())
    .join('\n')
    .trim()}\n\n${markdown}`

  // Update PR body
  const octokit = getOctokit(token)
  info('Description is being updated.')
  await octokit.rest.pulls.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
    body: updatedBody
  })
}

// Run main function
;(async () => {
  try {
    await action()
  } catch (err) {
    error(`Unexpected error: ${err instanceof Error ? err.message : err}`)
  }
})()
