# Engine phase 2: measure first

Phase 2 gives the engine an independent way to know whether it caused a sale. It adds the experiment service with holdouts, a permanent workspace holdout, a daily metrics pipeline, incremental gross profit on the Command Centre, and an attribution view that sets first-party credit, platform claims and experiment lift side by side. Nothing in later phases may learn from a number that did not come through here. The statistical rules are in [decisions.md](./decisions.md) under "Phase 2: how the engine measures lift"; Phase 1 conventions are in [engine-phase-1.md](./engine-phase-1.md).

## What was built

- Statistics: `src/features/engine/measure/stats.ts` is one isomorphic module used by the server and by the sample size calculator in the UI. It covers Welch intervals on gross profit per contact, Newcombe intervals and a beta-binomial probability for conversion rate, the sample ratio mismatch test, sample size and minimum detectable effect, and the assignment mapping. Tests compare it with scipy, statsmodels and a Monte Carlo reference.
- Permanent holdout: `engineWorkspace.globalHoldoutRate` (default 5%) holds back contacts by hash bucket. They are excluded from every experiment and, from phase 4, from every automated send. Changing the rate is audited because it restarts the baseline.
- Experiments (`measure/server/experimentService.ts`, `assignment.ts`, `results.ts`): `ab` and `holdout` kinds, deterministic SHA-256 assignment, audience rules (lifecycle stage, channel consent), an explicit state machine (draft, running, paused, completed, aborted), results per arm on both metrics with verdicts, and an hourly job that assigns newcomers, recomputes results and closes experiments past their end date.
- Metrics pipeline (`measure/server/metricsRollup.ts`): daily UTC rows in `engineMetricsDaily`, one `all` row per day plus one per channel, rebuilt idempotently by a nightly job or on demand.
- Incremental profit (`measure/server/incremental.ts`): treated contacts against the permanent holdout over any window, shown on the Command Centre and the Measurement screen.
- Attribution (`measure/attribution.ts`, `triangulation.ts`, `server/attributionService.ts`): five first-party models over a 30-day lookback, platform-reported numbers, experiment lift, and an empty media mix column for phase 7. Disagreements raise flags instead of being averaged.
- Screens: Experiments (list, create, sample size calculator), experiment detail (state controls, results with interval bars, sample ratio warning, assignment lookup), Measurement (incremental card, triangulation table, daily trend, recompute), and the permanent holdout setting.
- Fixes found while building: a re-synced order now updates its single purchase outcome, so refunds lower measured profit and a reclassified first order never leaves a duplicate. A re-sync without customer details keeps the existing contact link. Outcomes gained a `(contactId, occurredAt)` index for the results query.

## Data conventions

Days are UTC. Touches are events with a channel and type impression, click, open, visit, form, reply, call or meeting. Outcomes are `purchase`, `first_purchase` and `deal_won`. Spend arrives as events of type `spend` (value is the spend). Platform claims arrive as events of type `platform_report` (value is claimed revenue, `properties.conversions` the claimed conversions) until the phase 4 connectors write them directly. Unsubscribes and complaints are event types `unsubscribe` and `complaint`.

## Routes

All under `/api/engine/workspaces/{workspaceId}`.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET, POST | /experiments | viewer, marketer | list / create |
| GET, PATCH | /experiments/{experimentId} | viewer, marketer | read / edit (arms, holdout and audience only while draft) |
| POST | /experiments/{experimentId}/transition | marketer | start, pause, resume, complete or abort; starting assigns the population |
| POST | /experiments/{experimentId}/refresh | marketer | recompute results now |
| GET | /experiments/{experimentId}/assignment?contactId= | viewer | a contact's group, or why they are excluded |
| GET | /holdout | viewer | permanent holdout size |
| GET | /incremental?from&to | viewer | incremental gross profit against the permanent holdout |
| GET | /attribution?from&to&model&lookbackDays | viewer | triangulation report |
| GET | /metrics/daily?from&to&channelKey | viewer | daily rollup rows |
| POST | /metrics/rollup | admin | rebuild rollup rows for a range |

Jobs: `engine.experiments.refresh` hourly at minute 20, `engine.metrics.rollup` daily at 02:15 UTC (last three days for every workspace).

## How to run

```bash
bun backend                              # or `bun lite`
bun db:migrate
bun run:dev scripts/db/seed-engine.ts    # phase 1 data plus the phase 2 demo below
bun dev                                  # http://localhost:8081/engine
bun test:unit
```

The seed adds 5,000 nurture leads with email consent records, starts the "Autumn nurture email" holdout experiment six weeks in the past through the real experiment service (20% holdout, email channel, leads and MQLs with email consent), generates the orders and email touches that programme produced, adds 12 weeks of Meta and Google spend with platform claims, rolls up 90 days of metrics and refreshes the experiment. Re-running it changes nothing.

## Demo script (2 minutes)

1. Command Centre: gross profit this week against last, and the incremental card. The permanent holdout is only about 245 contacts, so its interval is wide and the verdict reads "inconclusive". That is the honest answer, and it narrows as the holdout accumulates history.
2. Experiments: "Autumn nurture email" is running with about 3,500 treated and 900 held out. Open it: gross profit per contact is higher in treatment with a 95% interval that excludes zero, so the verdict is positive, with incremental profit and its interval beside it. The sample ratio check passes.
3. Use the sample size calculator to show why the next email test needs more than three times the audience if the holdout drops from 20% to 5%.
4. Measurement: switch the attribution model between last touch and linear. Email's first-party credit lands close to its experiment lift, so it has no flag. Meta and Google are flagged because the platforms claim several times the conversions the first-party data supports, and neither has an experiment behind it.
5. Settings: the permanent holdout field explains that changing it restarts the baseline. The audit log records every transition, refresh and rollup with its reasoning.

## Verification

Typecheck is clean apart from the two pre-existing errors in `InboxScreen.tsx` and `KeyboardStickyFooter.native.tsx`. Lint, the quality check and the cycle check are clean on all engine files. `bun test:unit` passes 111 files and 762 tests. OpenAPI coverage reports only the pre-existing `POST /api/inbox-notices/:id/delete` gap. The API release is 0.2.0. Against the seeded database, the experiment's stored difference and interval were recomputed directly in SQL and with scipy and matched. Every stored assignment was recomputed with Postgres `sha256` and matched with no mismatches. A partial refund re-sync lowered the one outcome row and kept its contact.

## Known gaps

- Measurement windows are UTC days; workspace time zones come later.
- Geo tests, switchback tests and bandit allocation are not implemented yet: bandits are phase 5, geo tests and the media mix model are phase 7.
- Platform-reported numbers come from `platform_report` events until the phase 4 Meta connector writes them.
- Amounts in different currencies are summed without conversion. Every seeded workspace is single-currency.
- A fully refunded order keeps its outcome with negative gross profit and still counts as a conversion for its contact. That is intentional for profit but slightly overstates conversion rate.
- The screens are verified by typecheck, lint and server-side rendering of every route against the seeded API. They have not been exercised in a browser or on a device.
