# Agents in this repo

Every feature passes through an independent QA gate on a physical Android device
before anything is integrated or pushed. Product and technical context live in
`SPEC.md`; app-level coding rules live in `app/AGENTS.md`.

## Roles

| Role | Runs as | Owns | Never does |
| --- | --- | --- | --- |
| Orchestrator | Claude Code (coordinator terminal) | Feature definition, acceptance criteria, dispatch, diff review, evidence review, asking the owner for push approval | Writes feature code, approves a feature without a Tester report, pushes without the owner's explicit approval |
| Buscador (developer) | Antigravity, Orca worker `--agent antigravity` | Implementation, dev checks (`tsc`, `npm run verify`), and — only when the orchestrator relays the owner's approval — the commit and push | Declares its own work approved, pushes on its own initiative |
| Tester (QA) | Claude Sonnet 5.5, Orca worker `--agent claude --model claude-sonnet-5-5` | Building the exact version under test, running it on the device, screenshots, logs, the test report | Edits implementation code, fixes a defect, passes a criterion it did not observe |

## Rules

1. A feature is approved only by a Tester report whose verdict is `PASS`, and only after the orchestrator has checked that report's evidence.
2. The Tester tests a version fingerprint (commit + working-tree diff hash), not a claim. Buscador's delivery report is not sent to the Tester.
3. A defect goes Tester → orchestrator → Buscador. The Tester never patches code to make a test pass.
4. Nothing is committed or pushed automatically. Push happens only after a `PASS` and the owner's explicit approval, and only for the fingerprint that passed.
5. Completion counts only when a real Orca `worker_done` message arrives and validates. A dispatch, a file write, or prose claiming success is not completion.
6. Reports and screenshots hold no credentials, tokens, or personal data.

The full procedure is `docs/QA-PROTOCOL.md`. Tester instructions are `docs/TESTER.md`.
