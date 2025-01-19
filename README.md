<!-- Badges -->
[![Merge](https://github.com/bcgov/action-pr-description-add/actions/workflows/merge.yml/badge.svg)](https://github.com/bcgov/action-pr-description-add/actions/workflows/merge.yml)
[![CodeQL](https://github.com/bcgov/action-pr-description-add/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bcgov/action-pr-description-add/actions/workflows/github-code-scanning/codeql)
[![Contributors](https://img.shields.io/github/contributors/bcgov/action-pr-description-add)](/../../graphs/contributors)
[![Forks](https://img.shields.io/github/forks/bcgov/action-pr-description-add)](/../../network/members)
[![Stargazers](https://img.shields.io/github/stars/bcgov/action-pr-description-add)](/../../stargazers)
[![Issues](https://img.shields.io/github/issues/bcgov/action-pr-description-add)](/../../issues)
[![MIT License](https://img.shields.io/github/license/bcgov/action-pr-description-add.svg)](/LICENSE)
[![Lifecycle](https://img.shields.io/badge/Lifecycle-Experimental-339999)](https://github.com/bcgov/repomountie/blob/master/doc/lifecycle-badges.md)

# Add to Pull Request Descriptions

This action adds to Pull Request descriptions using markdown.  It checks if the message is already present before adding.

## Input

#### Required

`add_markdown`: The message to add to pull requests, in markdown.

#### Optional

`github_token`: ${{ secrets.GITHUB_TOKEN }} or a Personal Access Token (PAT).  Default is to inherit a token from the calling workflow.

`limit_to_pr_opened`: Only take action when PR status is opened or reopened.  Default = false.

## Permissions

#### Explicit rights
Repositories can have different permissions for their tokens.  It can't hurt to explicitly provide rights.  Read more [here](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token).

```
    permissions:
      pull-requests: write
```

#### Forks
Forks receive purposefully limited rights, preventing this action from running successfully.  It is recommended to avoid that with a condition.
```
    if: "!github.event.pull_request.head.repo.fork"
```

## Example #1, minimal

Create or modify a GitHub workflow, like below.  E.g. `./github/workflows/pr-append.yml`

```yaml
name: "Add to Pull Request Description"
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: bcgov/action-pr-description-add@main
        with:
          add_markdown: |
            ---

            # Things!
            ## Excitement!
            [Links!](https://google.ca)
            `Code!`
```

## Example #2, advanced


```yaml
name: "Add to Pull Request Description"
on:
  pull_request:

jobs:
  test:
    name: PR Greeting
    permissions:
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - uses: bcgov/action-pr-description-add@main
        with:
          github_token: "${{ secrets.GITHUB_TOKEN }}"
          limit_to_pr_opened: "true"
          add_markdown: |
            ---

            # Things!
            ## Excitement!
            [Links!](https://google.ca)
            `Code!`
            _Italics_
            *Bold*
            * Bullets!
            * and [more reading!](https://github.github.com/gfm/)
```

## Issues and Discussions

Please submit issues (bugs, feature requests) and take part in discussions at the links below.

BC Government QuickStart for OpenShift - [Issues](https://github.com/bcgov/quickstart-openshift/issues)

BC Government QuickStart for OpenShift - [Discussions](https://github.com/bcgov/quickstart-openshift/discussions)

## Contributing

Contributions are always welcome!  Please send us pull requests or get in touch at the links above.

## Acknowledgements

This Action is provided courtesty of NRIDS Architecture and Forestry Digital Services, parts of the Government of British Columbia.
