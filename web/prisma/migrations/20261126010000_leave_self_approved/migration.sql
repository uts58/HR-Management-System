-- Marks a leave decision made by the requester (sole active HR admin exception).
ALTER TABLE "leave_requests" ADD COLUMN "self_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_self_approved_decided_chk"
  CHECK (NOT "self_approved" OR "status" <> 'PENDING');
