# P08b1 — Reviewer Corrections recovery

Execution note for the approved P08b1 row in the phased implementation plan and H-05 screen contract. Begin after the P08a commit. The Decision Register and DESIGN.md govern implementation.

- Recover the reviewer queue and direct detail from the actual contract. Keep status, review tier and page context. Distinguish the original snapshot, submitted proposal and persisted approved values.
- Use the same authentication, role, forced-password and tenant gates for the direct read. Validate the UUID and return uniform 404 for missing or foreign records. Reuse the queue projection and the approved snapshot already available to the same roles on the correction trail.
- Preserve self-decision refusal, final statuses, second-HR eligibility and the Superadmin backstop attestation. Keep the current required UI decision note and optional API note. Reload current data after success or conflict without retrying the write.
- Guard the attendance update with the observed clock-in and worked hours. Roll back if the later correction status update loses so a 409 cannot commit an attendance change.
- Verify with focused frontend and mocked router tests, desktop and mobile intercepted browser checks, type checks and scoped QA and security review. Leave P08b2, P08c and P17b outside this slice.
