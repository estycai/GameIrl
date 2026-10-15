# QA protocol

How a feature goes from definition to push. Roles and hard rules are in
`AGENTS.md`; this file is the procedure the orchestrator follows.

## The cycle

```text
define ─► Buscador implements ─► orchestrator review ─► Tester on device ─► orchestrator checks evidence
                ▲                                                                   │
                └──────────────────────── FAIL: defects ◄───────────────────────────┤
                                                                                    ▼ PASS
                                                       owner approves ─► Buscador commits + pushes
```

1. **Define.** The orchestrator writes the feature and numbered acceptance criteria (`AC-1`, `AC-2`, ...). Each criterion must be observable on the device.
2. **Implement.** Dispatch Buscador:
   `orca orchestration worker-start --agent antigravity --worktree current --task-title "<feature>" --spec "<spec>" --json`
   The spec states: no commits, no pushes.
3. **Dev checks.** Buscador runs `npx tsc --noEmit` and `npm run verify` from `app/` and sends `worker_done`.
4. **Review.** The orchestrator validates the `worker_done` (`taskId`, `dispatchId`, `outcome: succeeded`), reads the diff, and reruns the review gate in `SPEC.md` section 10. A failure here goes back to Buscador without involving the Tester.
5. **Fingerprint.** The orchestrator records the version under test:
   ```bash
   git rev-parse HEAD
   { git diff HEAD -- . ':!artifacts'; git ls-files -z --others --exclude-standard -- . ':!artifacts' | xargs -0 -r sha256sum; } | sha256sum
   ```
   The second line hashes tracked changes and new untracked files together. `git diff` alone misses new files.
6. **Test.** Dispatch the Tester with the brief from `docs/TESTER.md`: feature, criteria, and fingerprint. Never Buscador's report. Only one worker uses the worktree at a time.
7. **Check evidence.** On the Tester's `worker_done`, the orchestrator opens `artifacts/qa/TEST-REPORT.md`, confirms that every criterion has a screenshot that exists and shows what the report claims, and confirms that the Tester changed nothing outside `artifacts/qa/` (`git status --porcelain`).
8. **FAIL.** Send the defects, with their screenshot paths, back to Buscador as a new task. After the fix, go back to step 4. A new fingerprint always means a new Tester run.
9. **PASS.** Tell the owner that the feature is approved and ask for authorization to integrate and push. With an explicit yes, and only if the fingerprint still matches, dispatch Buscador to commit and push.

## Settling workers

After each validated `worker_done`, run `worker-release --dispatch <id>`, then
`check --ack <delivery_id>`. Wait with
`orca orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 540000 --json`.
A timeout is a checkpoint, not a failure. Inspect with `worker-read`.

## Evidence layout

```text
artifacts/qa/
  TEST-REPORT.md          run log, newest run first
  <run-id>/               one folder per run: <YYYYMMDD-HHMM>-<feature-slug>
    01-<what>.png         real device screenshots
    logcat.txt            only when relevant, scrubbed of personal data
```
