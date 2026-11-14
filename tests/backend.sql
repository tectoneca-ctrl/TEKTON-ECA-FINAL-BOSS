begin;
create function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
declare caught boolean := false;
begin
  begin execute statement; exception when others then
    if position(expected in sqlerrm)=0 then raise exception 'Unexpected error: %, wanted: %',sqlerrm,expected; end if;
    caught:=true;
  end;
  if not caught then raise exception 'Expected failure: %',expected; end if;
  raise notice 'PASS: blocked %',expected;
end $$;
insert into auth.users(id,email) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'user'||i||'@example.test' from generate_series(1,10) i;
insert into public.erp_profiles(auth_id,name,email,role) values('00000000-0000-0000-0000-000000000001','Admin','admin@example.test','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.erp_mutate('[
 {"action":"insert","module":"projects","id":"10000000-0000-0000-0000-000000000001","data":{"code":"P-001","name":"Site One","client":"Client One","type":"SAQ1","site":"Manila","budget":"100000","status":"Planning"}},
 {"action":"insert","module":"projects","id":"10000000-0000-0000-0000-000000000002","data":{"code":"P-002","name":"Site Two","client":"Client Two","type":"SAQ2","site":"Cavite","budget":"200000","status":"Planning"}}
]', '20000000-0000-0000-0000-000000000001');
select pg_temp.assert_ok((select count(*) from public.erp_records where module='checklist' and project='P-001')>0,'project creates checklist transactionally');
reset role;
insert into public.erp_profiles(auth_id,name,email,role,project) values
 ('00000000-0000-0000-0000-000000000002','Documents','docs@example.test','documents',null),
 ('00000000-0000-0000-0000-000000000003','Foreman','foreman@example.test','foreman','P-001'),
 ('00000000-0000-0000-0000-000000000004','Client','client@example.test','client','P-001'),
 ('00000000-0000-0000-0000-000000000005','Finance','finance@example.test','finance',null),
 ('00000000-0000-0000-0000-000000000006','HR','hr@example.test','hr',null),
 ('00000000-0000-0000-0000-000000000007','Supervisor','supervisor@example.test','site_supervisor','P-001'),
 ('00000000-0000-0000-0000-000000000008','Second Admin','admin2@example.test','admin',null),
 ('00000000-0000-0000-0000-000000000009','Disabled','disabled@example.test','documents',null),
 ('00000000-0000-0000-0000-000000000010','Unassigned','unassigned@example.test','foreman',null);
update public.erp_profiles set disabled=true where auth_id='00000000-0000-0000-0000-000000000009';
set local role anon;
select pg_temp.expect_error($q$select public.erp_snapshot()$q$,'permission denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_ok((select count(*)=1 from public.erp_projects),'assigned role only reads its project');
select pg_temp.expect_error($q$insert into public.erp_projects(payload) values('{}')$q$,'permission denied');
select pg_temp.expect_error($q$select private.erp_write('{}')$q$,'permission denied');
select pg_temp.expect_error($q$select public.erp_update_profile('{"role":"admin"}')$q$,'Invalid profile update');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"purchases","id":"30000000-0000-0000-0000-000000000002","data":{"item":"Other site","project":"P-002","supplier":"Test","amount":"100","status":"Pending"}}]',gen_random_uuid())$q$,'permission');
select public.erp_mutate('[{"action":"insert","module":"purchases","id":"30000000-0000-0000-0000-000000000001","data":{"item":"Steel","project":"P-001","supplier":"Test","amount":"500","status":"Pending"}}]', '20000000-0000-0000-0000-000000000002');
select public.erp_mutate('[{"action":"insert","module":"purchases","id":"30000000-0000-0000-0000-000000000001","data":{"item":"Steel","project":"P-001","supplier":"Test","amount":"500","status":"Pending"}}]', '20000000-0000-0000-0000-000000000002');
select pg_temp.assert_ok((select count(*)=1 from public.erp_records where module='purchases'),'duplicate request does not duplicate purchase');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"update","module":"purchases","id":"30000000-0000-0000-0000-000000000001","version":1,"data":{"status":"Approved"}}]',gen_random_uuid())$q$,'Approval is required');
select public.erp_mutate('[{"action":"update","module":"purchases","id":"30000000-0000-0000-0000-000000000001","version":1,"data":{"amount":"600"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_ok((select count(*)=1 from public.erp_records where module='approvals'),'purchase has exactly one approval');
select pg_temp.expect_error(format('select public.erp_mutate(%L,gen_random_uuid())',jsonb_build_array(jsonb_build_object('action','decide','module','approvals','id',(select id from public.erp_records where module='approvals'),'version',1,'data',jsonb_build_object('status','Approved')))::text),'no longer pending');
select public.erp_mutate(jsonb_build_array(jsonb_build_object('action','decide','module','approvals','id',(select id from public.erp_records where module='approvals'),'version',2,'data',jsonb_build_object('status','Approved'))),gen_random_uuid());
select pg_temp.assert_ok((select payload->>'status'='Approved' from public.erp_records where id='30000000-0000-0000-0000-000000000001'),'approval updates linked request atomically');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"update","module":"purchases","id":"30000000-0000-0000-0000-000000000001","version":3,"data":{"amount":"1"}}]',gen_random_uuid())$q$,'details are locked');
select public.erp_mutate('[{"action":"insert","module":"purchases","id":"30000000-0000-0000-0000-000000000003","data":{"item":"Own request","project":"P-001","supplier":"Test","amount":"10","status":"Pending"}}]',gen_random_uuid());
select pg_temp.expect_error(format('select public.erp_mutate(%L,gen_random_uuid())',jsonb_build_array(jsonb_build_object('action','decide','module','approvals','id',(select id from public.erp_records where module='approvals' and payload->>'refId'='30000000-0000-0000-0000-000000000003'),'version',1,'data',jsonb_build_object('status','Approved')))::text),'Another admin');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"update","module":"projects","id":"10000000-0000-0000-0000-000000000001","version":1,"data":{"name":"Should rollback"}},{"action":"insert","module":"progress","id":"30000000-0000-0000-0000-000000000010","data":{"project":"P-001","milestone":"Wrong","percent":"101","date":""}}]',gen_random_uuid())$q$,'Progress must');
select pg_temp.assert_ok((select payload->>'name'='Site One' from public.erp_projects where code='P-001'),'batch failure rolls back every operation');
select public.erp_mutate('[{"action":"update","module":"projects","id":"10000000-0000-0000-0000-000000000001","version":1,"data":{"status":"Ongoing"}}]',gen_random_uuid());
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"update","module":"projects","id":"10000000-0000-0000-0000-000000000001","version":1,"data":{"name":"Stale"}}]',gen_random_uuid())$q$,'Record changed');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"delete","module":"projects","id":"10000000-0000-0000-0000-000000000001","version":2}]',gen_random_uuid())$q$,'foreign key');

-- Finance operations, idempotent collection and restricted document access.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select public.erp_mutate('[{"action":"insert","module":"billing","id":"40000000-0000-0000-0000-000000000001","data":{"invoice":"INV-1","project":"P-001","amount":"1000","due":"2026-11-20","status":"Sent"}}]',gen_random_uuid());
select public.erp_mutate('[{"action":"pay_invoice","module":"billing","id":"40000000-0000-0000-0000-000000000001","version":1}]','20000000-0000-0000-0000-000000000003');
select public.erp_mutate('[{"action":"pay_invoice","module":"billing","id":"40000000-0000-0000-0000-000000000001","version":1}]','20000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"pay_invoice","module":"billing","id":"40000000-0000-0000-0000-000000000001","version":1}]',gen_random_uuid())$q$,'already paid');
select pg_temp.assert_ok((select count(*)=1 from public.erp_records where module='payments'),'mark paid records exactly one collection');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"payroll","id":"40000000-0000-0000-0000-000000000009","data":{"employee":"Missing","period":"Test","gross":"1","deductions":"0","status":"Draft"}}]',gen_random_uuid())$q$,'Choose a valid employee');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"billing","id":"40000000-0000-0000-0000-000000000002","data":{"invoice":"INV-2","project":"P-001","amount":"1000","due":"","status":"Paid"}}]',gen_random_uuid())$q$,'Use Mark paid');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_ok((select count(*)=0 from public.erp_records where module in ('billing','payments','payroll')),'documents cannot read financial details');
select pg_temp.assert_ok(jsonb_array_length(public.erp_finance_summary())=0,'finance view is denied by default');
select pg_temp.expect_error($q$select public.erp_update_settings('{"company":"Changed","vat":0,"markup":0,"retention":0}')$q$,'Admin access');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"expenses","id":"30000000-0000-0000-0000-000000000011","data":{"item":"Not allowed","project":"P-001","category":"Other","amount":"1","date":""}}]',gen_random_uuid())$q$,'permission');
select public.erp_mutate('[{"action":"insert","module":"documents","id":"50000000-0000-0000-0000-000000000001","data":{"title":"Permit","project":"P-001","type":"Permit","expires":"","status":"Review"}},{"action":"insert","module":"documents","id":"50000000-0000-0000-0000-000000000002","data":{"title":"Other Site","project":"P-002","type":"Permit","expires":"","status":"Review"}}]',gen_random_uuid());
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('erp-documents','P-002/50000000-0000-0000-0000-000000000001/a')$q$,'row-level security');
insert into storage.objects(bucket_id,name) values('erp-documents','P-001/50000000-0000-0000-0000-000000000001/file');
select public.erp_mutate('[{"action":"update","module":"documents","id":"50000000-0000-0000-0000-000000000001","version":1,"data":{"fileId":"P-001/50000000-0000-0000-0000-000000000001/file","fileName":"permit.pdf","size":"100","mime":"application/pdf"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_ok((select count(*)=0 from public.erp_records where module='documents'),'client cannot see unapproved documents');
select pg_temp.assert_ok((select count(*)=0 from storage.objects),'client cannot download unapproved files');
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"tasks","id":"30000000-0000-0000-0000-000000000012","data":{"task":"Client write","project":"P-001","crew":"","due":"","status":"Todo"}}]',gen_random_uuid())$q$,'permission');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.erp_mutate('[{"action":"update","module":"documents","id":"50000000-0000-0000-0000-000000000001","version":2,"data":{"status":"Approved"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_ok((select count(*)=1 from public.erp_records where module='documents'),'client reads only approved documents for assigned project');
select pg_temp.assert_ok((select count(*)=1 from storage.objects),'client can download its approved file');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.erp_admin_profile((select id from public.erp_profiles where role='documents' and not disabled),'{"finance_view_project":"P-001"}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_ok(jsonb_array_length(public.erp_finance_summary())=1 and public.erp_finance_summary()->0->>'collected'='1000','finance grant returns only assigned summary');
select pg_temp.assert_ok((select count(*)=0 from public.erp_records where module in ('billing','payments','payroll')),'finance grant never exposes raw financial rows');
select public.erp_mutate('[{"action":"delete","module":"documents","id":"50000000-0000-0000-0000-000000000001","version":3}]',gen_random_uuid());
delete from storage.objects where name='P-001/50000000-0000-0000-0000-000000000001/file';
select pg_temp.assert_ok((select count(*)=0 from storage.objects),'document deletion permits orphan file cleanup');
select pg_temp.assert_ok(jsonb_array_length(public.erp_snapshot()->'users')=1,'non-admin snapshot exposes only own profile');
select pg_temp.expect_error(format('select public.erp_mutate(%L,gen_random_uuid())',jsonb_build_array(jsonb_build_object('action','update','module','checklist','id',(select id from public.erp_records where module='checklist' and project='P-001' and payload->>'out'='MOC'),'version',1,'data',jsonb_build_object('outStatus','Out','outDate','2026-11-14')))::text),'Complete the required documents');

-- HR, project worker references, approved attendance, server payroll calculation.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select public.erp_mutate('[{"action":"insert","module":"employees","id":"60000000-0000-0000-0000-000000000001","data":{"name":"Worker One","position":"Mason","rate":"800","hired":"2026-01-01","project":"P-001","status":"Active"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error($q$select public.erp_mutate('[{"action":"insert","module":"attendance","id":"60000000-0000-0000-0000-000000000002","data":{"worker":"Worker One","project":"P-001","date":"2026-11-14","days":"1","ot":"2","status":"Approved"}}]',gen_random_uuid())$q$,'attendance is locked');
select public.erp_mutate('[{"action":"insert","module":"attendance","id":"60000000-0000-0000-0000-000000000002","data":{"worker":"Worker One","project":"P-001","date":"2026-11-14","days":"1","ot":"2","status":"Pending"}},{"action":"insert","module":"attendance","id":"60000000-0000-0000-0000-000000000003","data":{"worker":"Worker One","project":"P-001","date":"2026-11-13","days":"1","ot":"0","status":"Pending"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
select public.erp_mutate('[{"action":"update","module":"attendance","id":"60000000-0000-0000-0000-000000000002","version":1,"data":{"status":"Approved"}}]',gen_random_uuid());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select public.erp_mutate('[{"action":"generate_payroll","module":"payroll","data":{"from":"2026-11-01","to":"2026-11-15"}}]',gen_random_uuid());
select public.erp_mutate('[{"action":"generate_payroll","module":"payroll","data":{"from":"2026-11-01","to":"2026-11-15"}}]',gen_random_uuid());
select pg_temp.assert_ok((select count(*)=1 and max(payload->>'gross')='1050' from public.erp_records where module='payroll'),'payroll uses only approved attendance without duplicates');
select public.erp_mutate(jsonb_build_array(jsonb_build_object('action','update','module','payroll','id',(select id from public.erp_records where module='payroll'),'version',1,'data',jsonb_build_object('status','Approved'))),gen_random_uuid());
select pg_temp.expect_error(format('select public.erp_mutate(%L,gen_random_uuid())',jsonb_build_array(jsonb_build_object('action','update','module','payroll','id',(select id from public.erp_records where module='payroll'),'version',2,'data',jsonb_build_object('status','Paid')))::text),'Only Finance');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select public.erp_mutate(jsonb_build_array(jsonb_build_object('action','update','module','payroll','id',(select id from public.erp_records where module='payroll'),'version',2,'data',jsonb_build_object('status','Paid'))),gen_random_uuid());
select pg_temp.assert_ok((select payload->>'status'='Paid' from public.erp_records where module='payroll'),'finance releases approved payroll');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
select pg_temp.assert_ok((select count(*)=0 from public.erp_projects),'disabled account cannot read projects');
select pg_temp.expect_error($q$select public.erp_snapshot()$q$,'No active ERP account');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
select pg_temp.assert_ok((select count(*)=0 from public.erp_projects),'unassigned scoped account cannot read any project');
select pg_temp.assert_ok((select count(*)=0 from public.erp_records),'unassigned scoped account cannot read records');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.erp_update_settings('{"version":1,"company":"Test company","vat":12,"markup":15,"retention":10}');
select pg_temp.expect_error($q$select public.erp_update_settings('{"version":1,"company":"Stale company","vat":12,"markup":15,"retention":10}')$q$,'Settings changed');
select pg_temp.assert_ok((select count(*)>10 from public.erp_audit where actor is not null),'database writes create server audit events');
select pg_temp.expect_error($q$insert into public.erp_audit(actor,actor_name,message) values(null,'Fake','Forged')$q$,'permission denied');
rollback;
