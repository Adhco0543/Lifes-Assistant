# Learn AI coding agents with Life's Assistant

These files configure *custom GitHub Copilot agent profiles*. They are instructions, **not** an always-running autonomous team. They become available only in supported Copilot environments after the changes are merged or the relevant branch is selected. Account access and usage limits may apply.

## Three teammates
- `lifes-builder`: makes small code changes and proposes a pull request.
- `lifes-security`: reviews code for security vulnerabilities without editing it.
- `lifes-tester`: creates and runs targeted tests, reporting results.

## First lesson: a safe agent task

1. Open https://github.com/copilot/agents and sign in.
2. Choose the **Adhco0543/Lifes-Assistant** repository.
3. After this setup pull request is reviewed and merged, select **lifes-builder** (if your Copilot account supports custom agents).
4. Paste the prompt:

   > Inspect Life's Assistant. Find three improvements that would make the app more reliable. Do not edit files yet. Explain what each affected file does and tell me which improvement is easiest for a beginner to understand.

5. Once you choose an improvement, ask the builder to make **one small change** on a separate branch and open a pull request.
6. Ask the security agent to review the change and the tester to recommend tests.
7. Review the PR's **Files changed** and **Checks** tabs before deciding whether to merge. Merging to `main` may trigger a Vercel deployment.

## Five Git terms

- **Repository:** the project folder on GitHub.
- **Branch:** an alternate workspace for trying changes safely.
- **Commit:** a saved snapshot of code.
- **Pull request:** a proposal to add changes from one branch to another.
- **Merge:** accept proposed changes into a branch.

## Safety

Never paste passwords, private API keys or private customer information into agent prompts. `NEXT_PUBLIC_*` values are exposed to browsers, so never use them for private provider secrets. No agent should be trusted to auto-merge into production.

## Quiz

**Question:** Does opening a pull request automatically put the change into the live app?

**Answer:** No. A pull request proposes a change. Merging to a branch wired to Vercel can trigger deployment.
