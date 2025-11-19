import {error, getInput, info} from '@actions/core'
import {context, getOctokit} from '@actions/github'

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
 * Checks if the markdown block already exists in the PR body
 * Uses normalized comparison to handle whitespace differences
 */
function isMarkdownPresent(body: string, markdownToCheck: string): boolean {
  const normalizedBody = normalizeText(body)
  const normalizedMarkdown = normalizeText(markdownToCheck)
  
  // Check if the normalized markdown exists in the normalized body
  return normalizedBody.includes(normalizedMarkdown)
}

/**
 * Removes the markdown block from the PR body if it exists
 * Uses normalized comparison to find and remove duplicates
 */
function removeMarkdownBlock(body: string, markdownToRemove: string): string {
  const normalizedBody = normalizeText(body)
  const normalizedMarkdown = normalizeText(markdownToRemove)
  
  // If markdown is not present, return original body
  if (!normalizedBody.includes(normalizedMarkdown)) {
    return body
  }
  
  // Split body and markdown into lines for processing
  const bodyLines = body.split('\n')
  const markdownLines = markdownToRemove.split('\n')
  
  // Normalize each line for comparison
  const normalizedBodyLines = bodyLines.map(line => normalizeText(line))
  const normalizedMarkdownLines = markdownLines.map(line => normalizeText(line))
  
  // Find the matching block by searching for the sequence of normalized markdown lines
  let blockStart = -1
  let blockEnd = -1
  
  for (let i = 0; i <= normalizedBodyLines.length - normalizedMarkdownLines.length; i++) {
    let match = true
    for (let j = 0; j < normalizedMarkdownLines.length; j++) {
      const bodyLine = normalizedBodyLines[i + j]
      const markdownLine = normalizedMarkdownLines[j]
      
      // Match if lines are equal or body line contains markdown line (for flexibility)
      if (bodyLine !== markdownLine && !bodyLine.includes(markdownLine)) {
        match = false
        break
      }
    }
    
    if (match) {
      blockStart = i
      blockEnd = i + normalizedMarkdownLines.length
      break
    }
  }
  
  // If we found a match, remove the block
  if (blockStart !== -1) {
    const result: string[] = []
    
    // Add lines before the block
    for (let i = 0; i < blockStart; i++) {
      result.push(bodyLines[i])
    }
    
    // Skip blank lines immediately after the block
    let skipIndex = blockEnd
    while (skipIndex < bodyLines.length && bodyLines[skipIndex].trim() === '') {
      skipIndex++
    }
    
    // Add remaining lines after the block
    for (let i = skipIndex; i < bodyLines.length; i++) {
      result.push(bodyLines[i])
    }
    
    return result.join('\n').trim()
  }
  
  // Fallback: if exact block match failed, try removing via normalized string replacement
  // This is a last resort for edge cases
  const normalizedResult = normalizedBody.replace(normalizedMarkdown, '').trim()
  if (normalizedResult !== normalizedBody) {
    // Reconstruct by removing the normalized markdown from normalized body
    // and mapping back to original structure as best we can
    info('Using fallback removal method for markdown block.')
    return normalizedResult
  }
  
  return body
}

/**
 * Fetches the current PR body from the API with retry logic
 */
async function fetchPRBody(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      info(`Fetching PR body from API (attempt ${attempt}/${maxRetries})...`)
      const {data: pr} = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      })
      const body = pr.body || ''
      info('Successfully fetched PR body from API.')
      return body
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (attempt === maxRetries) {
        error(`Failed to fetch PR from API after ${maxRetries} attempts: ${errorMessage}`)
        throw err
      }
      info(`Attempt ${attempt} failed: ${errorMessage}. Retrying...`)
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
    }
  }
  return ''
}

/**
 * Updates the PR body with retry logic to handle race conditions
 */
async function updatePRBody(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  markdownToAdd: string,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      info(`Updating PR description (attempt ${attempt}/${maxRetries})...`)
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body
      })
      info('Successfully updated PR description.')
      return
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const statusCode = (err as {status?: number})?.status
      
      // If it's a 409 conflict (concurrent modification), retry with fresh data
      if (statusCode === 409 && attempt < maxRetries) {
        info(`Concurrent modification detected (409). Fetching latest PR body and retrying...`)
        try {
          const {data: pr} = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber
          })
          const currentBody = pr.body || ''
          
          // Re-check if markdown is present in the fresh body
          if (isMarkdownPresent(currentBody, markdownToAdd)) {
            info('Markdown is already present in the updated PR body. Exiting.')
            return
          }
          
          // Re-remove duplicates and update
          const bodyWithoutDuplicates = removeMarkdownBlock(currentBody, markdownToAdd)
          body = bodyWithoutDuplicates
            ? `${bodyWithoutDuplicates.trim()}\n\n${markdownToAdd}`
            : markdownToAdd
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
          continue
        } catch (fetchErr) {
          error(`Failed to fetch fresh PR body during retry: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}`)
        }
      }
      
      if (attempt === maxRetries) {
        error(`Failed to update PR after ${maxRetries} attempts: ${errorMessage}`)
        throw err
      }
      
      info(`Attempt ${attempt} failed: ${errorMessage}. Retrying...`)
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
    }
  }
}

// Main function
async function action(): Promise<void> {
  // Ensure pull request exists
  if (!context.payload.pull_request) {
    error('Error: No pull request found in context. Exiting.')
    return
  }

  const prNumber = context.payload.pull_request.number
  const owner = context.repo.owner
  const repo = context.repo.repo
  const octokit = getOctokit(token)

  // Fetch latest PR body from API to avoid race conditions
  let currentBody = ''
  try {
    currentBody = await fetchPRBody(octokit, owner, repo, prNumber)
  } catch (err) {
    // Fallback to context if all retries fail
    error('All retry attempts failed. Falling back to context PR body.')
    currentBody = context.payload.pull_request?.body || ''
    info('Using context PR body as fallback.')
  }

  // Check if markdown is already present using normalized comparison
  if (isMarkdownPresent(currentBody, markdown)) {
    info('Markdown message is already present (normalized comparison). Exiting.')
    return
  }

  // Remove any existing duplicates and append markdown
  const bodyWithoutDuplicates = removeMarkdownBlock(currentBody, markdown)
  const updatedBody = bodyWithoutDuplicates
    ? `${bodyWithoutDuplicates.trim()}\n\n${markdown}`
    : markdown

  // Update PR body with retry logic
  await updatePRBody(octokit, owner, repo, prNumber, updatedBody, markdown)
}

// Run main function
;(async () => {
  try {
    await action()
  } catch (err) {
    error(`Unexpected error: ${err instanceof Error ? err.message : err}`)
  }
})()
