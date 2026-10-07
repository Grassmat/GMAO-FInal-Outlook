-- Owner-requested wipe. Only test IDs observed before publication are affected.
-- Preserve Google Sheets reports, sites, machines, users, permissions and form.
UPDATE interventions SET deleted=1,deleted_by='owner-requested-test-cleanup',deleted_at='2026-10-05T13:30:35.242Z',revision=revision+1
WHERE id IN ('52838898-9da3-416c-bfe7-cf67647f07b1') AND source<>'Google Sheets' AND deleted=0;
--> statement-breakpoint
UPDATE records SET data=json_set(data,'$.deleted',1,'$.revision',COALESCE(json_extract(data,'$.revision'),0)+1)
WHERE id IN ('76ffc950-2631-42eb-9278-7f1fb5915e1a','789879a8-3cb3-46c6-8fbb-7d1e20556606','a10717e2-64b2-4e3f-a832-869635da6ca0','purchase-part:789879a8-3cb3-46c6-8fbb-7d1e20556606') AND kind IN ('part','order','plan','routine') AND COALESCE(json_extract(data,'$.deleted'),0)=0;
--> statement-breakpoint
DELETE FROM records WHERE kind='routine_done' AND json_extract(data,'$.routine') IN ('76ffc950-2631-42eb-9278-7f1fb5915e1a','789879a8-3cb3-46c6-8fbb-7d1e20556606','a10717e2-64b2-4e3f-a832-869635da6ca0','purchase-part:789879a8-3cb3-46c6-8fbb-7d1e20556606');
--> statement-breakpoint
DELETE FROM movements WHERE part IN ('76ffc950-2631-42eb-9278-7f1fb5915e1a','789879a8-3cb3-46c6-8fbb-7d1e20556606','a10717e2-64b2-4e3f-a832-869635da6ca0','purchase-part:789879a8-3cb3-46c6-8fbb-7d1e20556606') OR intervention IN ('52838898-9da3-416c-bfe7-cf67647f07b1');
--> statement-breakpoint
DELETE FROM purchase_receipts WHERE order_id IN ('76ffc950-2631-42eb-9278-7f1fb5915e1a','789879a8-3cb3-46c6-8fbb-7d1e20556606','a10717e2-64b2-4e3f-a832-869635da6ca0','purchase-part:789879a8-3cb3-46c6-8fbb-7d1e20556606');

