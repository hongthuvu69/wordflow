-- WordFlow: bảng đồng bộ tiến độ học giữa app Qt (PC) và web app (iPhone).
-- Chạy một lần trong Supabase Dashboard → SQL Editor → New query → dán toàn bộ → Run.

-- Mỗi dòng = trạng thái ôn tập của một từ. Khi hai thiết bị cùng sửa một từ,
-- bản có updated_at mới hơn sẽ thắng.
create table if not exists public.progress (
    user_id       uuid   not null default auth.uid() references auth.users (id) on delete cascade,
    word_id       text   not null,
    state         int    not null default 0,
    ease          double precision not null default 2.5,
    interval_days double precision not null default 0,
    reps          int    not null default 0,
    lapses        int    not null default 0,
    due           bigint not null default 0,   -- giây (Unix time)
    first_seen    bigint not null,
    last_review   bigint not null,
    updated_at    bigint not null,
    primary key (user_id, word_id)
);

-- Lịch sử từng lượt ôn (để tính chuỗi ngày học, số lượt ôn hôm nay).
-- uid do thiết bị tạo ra để không bị đẩy trùng.
create table if not exists public.reviews (
    id      bigint generated always as identity primary key,
    uid     text   not null unique,
    user_id uuid   not null default auth.uid() references auth.users (id) on delete cascade,
    word_id text   not null,
    rating  int    not null,
    ts      bigint not null
);

create index if not exists reviews_user_id_idx on public.reviews (user_id, id);

-- Bảo mật: mỗi người chỉ đọc/ghi được dữ liệu của chính mình.
alter table public.progress enable row level security;
alter table public.reviews  enable row level security;

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
