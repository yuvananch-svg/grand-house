-- Grand House full-stack-ready schema draft
-- ใช้เป็นฐานสำหรับ migration จริงเท่านั้น ก่อนใช้จริงต้องรันผ่าน Supabase CLI/MCP และตรวจ advisors

create table if not exists public.branches (
  id text primary key,
  name text not null unique
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'staff')),
  branch_id text references public.branches(id),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  type text not null check (type in ('raw_material', 'packaging', 'purchased_finished_good', 'produced_finished_good')),
  category text not null,
  unit text not null,
  sale_price numeric(12,2),
  supplier text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_lots (
  id text primary key,
  product_id text not null references public.products(id),
  branch_id text not null references public.branches(id),
  quantity_in numeric(12,3) not null check (quantity_in >= 0),
  remaining numeric(12,3) not null check (remaining >= 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  received_date date not null,
  expiry_date date not null,
  source text not null,
  supplier text,
  status_override text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  name text not null,
  output_product_id text not null references public.products(id),
  output_qty numeric(12,3) not null check (output_qty > 0),
  output_unit text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id bigserial primary key,
  recipe_id text not null references public.recipes(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null
);

create table if not exists public.sales (
  id text primary key,
  document_no text not null unique,
  sale_date date not null,
  branch_id text not null references public.branches(id),
  channel text not null check (channel in ('QR1', 'QR2', 'ไทยช่วยไทย', 'เงินสด', 'online(grab)', 'อื่นๆ')),
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  cost_of_goods numeric(12,2) not null,
  gross_profit numeric(12,2) not null,
  vat_amount numeric(12,2) not null default 0,
  note text,
  status text not null default 'ปกติ' check (status in ('ปกติ', 'ยกเลิก')),
  voided_date date,
  void_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id text primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text not null references public.products(id),
  lot_id text not null references public.inventory_lots(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  revenue numeric(12,2) not null,
  cost_of_goods numeric(12,2) not null,
  line_type text not null default 'ขาย' check (line_type in ('ขาย', 'แถมโปร', 'แถมเอง')),
  promo_label text
);

create table if not exists public.payments (
  id text primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  payment_date date not null,
  branch_id text not null references public.branches(id),
  channel text not null check (channel in ('QR1', 'QR2', 'ไทยช่วยไทย', 'เงินสด', 'online(grab)', 'อื่นๆ')),
  amount numeric(12,2) not null check (amount >= 0)
);

create table if not exists public.inventory_movements (
  id text primary key,
  movement_date date not null,
  branch_id text not null references public.branches(id),
  lot_id text not null references public.inventory_lots(id),
  product_id text not null references public.products(id),
  type text not null,
  quantity_change numeric(12,3) not null,
  value_change numeric(12,2) not null,
  linked_id text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.accounting_documents (
  id text primary key,
  document_no text not null unique,
  type text not null,
  document_date date not null,
  branch_id text not null references public.branches(id),
  party text not null,
  category text not null,
  amount_before_vat numeric(12,2) not null,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  linked_id text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.close_shifts (
  id text primary key,
  document_no text not null unique,
  shift_date date not null,
  branch_id text not null references public.branches(id),
  expected_by_channel jsonb not null,
  actual_by_channel jsonb not null,
  expected_total numeric(12,2) not null,
  actual_total numeric(12,2) not null,
  difference numeric(12,2) not null,
  sales_total numeric(12,2) not null,
  cost_of_goods numeric(12,2) not null,
  gross_profit numeric(12,2) not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid references auth.users(id),
  reason text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.accounting_documents enable row level security;
alter table public.close_shifts enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security invoker
as $$
  select public.current_user_role() = 'owner'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
as $$
  select public.current_user_role() in ('owner', 'staff')
$$;

-- Draft policies. ปรับชื่อ/logic อีกครั้งเมื่อเชื่อม Supabase Auth จริง
create policy "owners can read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

create policy "owners can manage master data" on public.products for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

create policy "staff can read active products" on public.products for select using (active = true);

create policy "staff can read branches" on public.branches for select using (public.is_staff());
create policy "owners can manage branches" on public.branches for all using (public.is_owner()) with check (public.is_owner());

create policy "staff can read inventory lots" on public.inventory_lots for select using (public.is_staff());
create policy "staff can insert inventory lots" on public.inventory_lots for insert with check (public.is_staff());
create policy "owners can update inventory lots" on public.inventory_lots for update using (public.is_owner()) with check (public.is_owner());

create policy "staff can read recipes" on public.recipes for select using (public.is_staff());
create policy "owners can manage recipes" on public.recipes for all using (public.is_owner()) with check (public.is_owner());
create policy "staff can read recipe ingredients" on public.recipe_ingredients for select using (public.is_staff());
create policy "owners can manage recipe ingredients" on public.recipe_ingredients for all using (public.is_owner()) with check (public.is_owner());

create policy "staff can insert sales" on public.sales for insert with check (public.is_staff());
create policy "staff can read own branch sales" on public.sales for select using (
  public.is_owner()
  or branch_id = (select branch_id from public.profiles where id = auth.uid())
);
create policy "owners can update sales" on public.sales for update using (public.is_owner()) with check (public.is_owner());

create policy "staff can insert sale items" on public.sale_items for insert with check (public.is_staff());
create policy "staff can read sale items" on public.sale_items for select using (
  public.is_owner()
  or exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
    and s.branch_id = (select branch_id from public.profiles where id = auth.uid())
  )
);

create policy "staff can insert payments" on public.payments for insert with check (public.is_staff());
create policy "staff can read payments" on public.payments for select using (
  public.is_owner()
  or branch_id = (select branch_id from public.profiles where id = auth.uid())
);

create policy "staff can insert movements" on public.inventory_movements for insert with check (public.is_staff());
create policy "staff can read movements" on public.inventory_movements for select using (
  public.is_owner()
  or branch_id = (select branch_id from public.profiles where id = auth.uid())
);

create policy "owners can read accounting documents" on public.accounting_documents for select using (public.is_owner());
create policy "owners can manage accounting documents" on public.accounting_documents for all using (public.is_owner()) with check (public.is_owner());

create policy "staff can insert close shifts" on public.close_shifts for insert with check (public.is_staff());
create policy "staff can read own branch close shifts" on public.close_shifts for select using (
  public.is_owner()
  or branch_id = (select branch_id from public.profiles where id = auth.uid())
);
create policy "owners can update close shifts" on public.close_shifts for update using (public.is_owner()) with check (public.is_owner());

create policy "owners can read audit logs" on public.audit_logs for select using (public.is_owner());
create policy "system can insert audit logs" on public.audit_logs for insert with check (auth.uid() is not null);

-- สำหรับตาราง transaction จริง แนะนำให้ mutation ผ่าน server-side RPC/Edge Function
-- เพื่อ validate stock, expiry, role, และ audit trail ก่อนเขียนหลายตารางพร้อมกัน
