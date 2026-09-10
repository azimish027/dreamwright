-- ============================================================
-- IP创作工作台 · 数据库初始化脚本（只需执行一次）
--
-- 怎么用：打开控制台左侧「数据库」→ 找到「SQL 编辑器 / 新建查询 /
-- 数据管理」→ 把下面【从 create 到 $$; 结束】的全部内容粘进去 → 点运行。
-- 成功后会提示执行完成，表是空的没关系，数据会在注册账号后自动写入。
-- 此脚本可以重复执行，不会报错（都带 IF NOT EXISTS / OR REPLACE）。
-- ============================================================

-- 1) 账号表
CREATE TABLE IF NOT EXISTS public.ip_users (
  username TEXT PRIMARY KEY,
  salt     TEXT NOT NULL,
  hash     TEXT NOT NULL,
  created  BIGINT NOT NULL DEFAULT 0
);

-- 2) 会话令牌表
CREATE TABLE IF NOT EXISTS public.ip_tokens (
  token    TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  exp      BIGINT NOT NULL DEFAULT 0
);

-- 3) 同步数据表（所有内容都存这里，用 cat 区分类型）
CREATE TABLE IF NOT EXISTS public.ip_recs (
  uid       TEXT NOT NULL,
  rid       TEXT NOT NULL,
  cat       TEXT NOT NULL DEFAULT '',
  obj       JSONB,
  updatedat BIGINT NOT NULL DEFAULT 0,
  deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (uid, rid)
);
CREATE INDEX IF NOT EXISTS ip_recs_uid_idx ON public.ip_recs (uid);

-- 4) 授权给云函数使用的角色（service_role）
GRANT ALL ON public.ip_users  TO service_role;
GRANT ALL ON public.ip_tokens TO service_role;
GRANT ALL ON public.ip_recs   TO service_role;

-- 5) 合并函数：只有"云端时间戳更新"的写入才覆盖旧数据（多设备同步防丢）
CREATE OR REPLACE FUNCTION public.upsert_rec(
  p_uid TEXT, p_rid TEXT, p_cat TEXT, p_obj JSONB,
  p_updatedat BIGINT, p_deleted BOOLEAN
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ip_recs (uid, rid, cat, obj, updatedat, deleted)
  VALUES (p_uid, p_rid, p_cat, p_obj, p_updatedat, p_deleted)
  ON CONFLICT (uid, rid) DO UPDATE SET
    cat = EXCLUDED.cat,
    obj = EXCLUDED.obj,
    updatedat = EXCLUDED.updatedat,
    deleted = EXCLUDED.deleted
  WHERE public.ip_recs.updatedat < EXCLUDED.updatedat;
END $$;

-- 完成。接下来：给云函数配环境变量 ENV_ID / API_KEY / ACCESS_KEY，并开 HTTP 访问。
