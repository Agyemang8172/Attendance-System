# Job runbook: automatic clock-out

The auto clock-out job closes open attendance sessions after the scheduled shift end
recorded on the row plus the policy's offset, and flags anything ambiguous to HR review
instead of guessing a time. It never overwrites a real clock-out, so running it twice in
a row changes nothing the second time.

The run itself is rate-limited to five runs per minute per IP, far above the intended
one pass every 15 minutes, so the scheduler is never throttled but hammering is.

**Who may call it:** only a caller holding the `JOB_TOKEN` service secret from the
server environment. If the token is unset, the route answers 401 to everyone rather
than running open.

## Run one pass

```bash
curl -X POST https://host/api/jobs/auto-clock-out/run -H "Authorization: Bearer $JOB_TOKEN"
```

The body is optional. Send nothing at all for a sweep over every active business, or aim
it at one business with `{"businessId": "<uuid>"}`.

The response repeats back `{ closed, flagged, businesses }` — how many sessions were
closed automatically, how many were flagged for review, and how many businesses were
swept. A 409 means another run is still holding the sweep lock; wait a moment and try
again. The job is meant to run every 15 minutes (decision O8), driven from outside the
application — on the current Windows deployment, a Task Scheduler task on the server can
call this URL once every 15 minutes. No in-app timer exists.

## Check the last run

```bash
curl https://host/api/jobs/status -H "Authorization: Bearer $JOB_TOKEN"
```

This answers `{ lastRun, closed, flagged }` for the most recent pass. A SUPERADMIN may
also call it from a browser session, in which case it reports only their own business's
numbers.
