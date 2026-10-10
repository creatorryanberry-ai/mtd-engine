import * as v from 'valibot'

import { errorResponseSchema } from '~/contract'
import {
  createExperimentInputSchema,
  engineExperimentSchema,
  experimentAssignmentQuerySchema,
  experimentAssignmentSchema,
  experimentResultSchema,
  globalHoldoutStatusSchema,
  transitionExperimentInputSchema,
  updateExperimentInputSchema,
} from '~/features/engine/contract'

import { engineRoute, forbidden, notFound, unauthorized } from './engine'

/** phase 2 experiment routes: holdout and a/b experiments, assignment, results */
export const engineExperimentsRegistered = true

const WS = '/api/engine/workspaces/{workspaceId}'
const EXPERIMENT = `${WS}/experiments/{experimentId}`

const badRequest = {
  status: 400,
  description: 'Invalid experiment configuration',
  schema: errorResponseSchema,
}
const conflict = {
  status: 409,
  description: 'Not allowed in the experiment status',
  schema: errorResponseSchema,
}
const killSwitch = {
  status: 423,
  description: 'Workspace kill switch is on',
  schema: errorResponseSchema,
}

engineRoute({
  method: 'GET',
  path: `${WS}/experiments`,
  summary: 'List experiments',
  description:
    'Newest first, with arms, the number of assigned contacts and the last stored result.',
  role: 'viewer',
  output: v.object({ items: v.array(engineExperimentSchema) }),
})

engineRoute({
  method: 'POST',
  path: `${WS}/experiments`,
  summary: 'Create a draft experiment',
  description:
    'Holdout experiments need a holdout rate of at least 0.02 (default 0.1) and get one Treatment arm when none is given. A/b tests need at least two arms and exactly one control; the first arm becomes the control when none is flagged. Assignment is deterministic from a random per-experiment salt.',
  role: 'marketer',
  input: createExperimentInputSchema,
  output: engineExperimentSchema,
  errorResponses: [badRequest, unauthorized, forbidden, notFound],
})

engineRoute({
  method: 'GET',
  path: EXPERIMENT,
  summary: 'Get an experiment',
  role: 'viewer',
  output: engineExperimentSchema,
})

engineRoute({
  method: 'PATCH',
  path: EXPERIMENT,
  summary: 'Update an experiment',
  description:
    'Arms, holdout rate, audience and success metric only change while the experiment is a draft. Completed and aborted experiments only accept name and channel changes.',
  role: 'marketer',
  input: updateExperimentInputSchema,
  output: engineExperimentSchema,
  errorResponses: [badRequest, unauthorized, forbidden, notFound, conflict],
})

engineRoute({
  method: 'POST',
  path: `${EXPERIMENT}/transition`,
  summary: 'Start, pause, complete or abort an experiment',
  description:
    'draft to running or aborted; running to paused, completed or aborted; paused to running, completed or aborted. Starting sets startsAt and assigns every eligible contact (outside the permanent holdout, inside the audience, with consent when required). Completing closes the window at now and stores the final result. Starting is refused while the kill switch is on.',
  role: 'marketer',
  input: transitionExperimentInputSchema,
  output: engineExperimentSchema,
  errorResponses: [unauthorized, forbidden, notFound, conflict, killSwitch],
})

engineRoute({
  method: 'POST',
  path: `${EXPERIMENT}/refresh`,
  summary: 'Recompute and store the experiment result',
  description:
    'Intent to treat on gross profit per contact (Welch 95% interval) and conversion rate (Newcombe interval, z test, beta-binomial probability), with a sample ratio mismatch check. Verdicts stay collecting until every group reaches minSamplePerArm. The worker also refreshes running experiments hourly.',
  role: 'marketer',
  output: experimentResultSchema,
})

engineRoute({
  method: 'GET',
  path: `${EXPERIMENT}/assignment`,
  summary: "A contact's group in an experiment",
  description:
    'Returns the stored assignment. While the experiment runs, an eligible contact without one is assigned on read; excluded contacts report the reason (global_holdout, audience or consent).',
  role: 'viewer',
  input: experimentAssignmentQuerySchema,
  output: experimentAssignmentSchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/holdout`,
  summary: 'Permanent workspace holdout',
  description:
    'The global holdout rate and how many contacts it currently keeps out of every experiment and automated send.',
  role: 'viewer',
  output: globalHoldoutStatusSchema,
})
