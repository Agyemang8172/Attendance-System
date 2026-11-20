# P08b2a — HR own correction tracking

Owner approved the tracking split and explicitly authorized the missing P05 reads. The accepted P05 contract specifies authenticated STAFF and HR own list and detail reads under /api/attendance/corrections. Preserve caller tenant and requester ownership, the forced-password gate, status and pagination, safe projection, and established 403 and 404 behavior. Preserve the existing correction namespace pass-through before the generic attendance ID route. Staff and reviewer contracts and all writes retain their existing behavior.

After API tests and scoped review, add a separate HR tracking view with own list and detail, status filtering, paging and return context. P08b2b remains deferred until the authorized current business-timezone read and applicable P17b prerequisites are complete.
