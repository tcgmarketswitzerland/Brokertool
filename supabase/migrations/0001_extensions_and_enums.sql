-- Phase 0 - Grundlagen
-- gen_random_uuid() und sha256() sind seit PostgreSQL 13 bzw. 11 eingebaut;
-- pgcrypto wird nicht benoetigt.

create extension if not exists "citext";
create extension if not exists "pg_trgm";

create type org_role as enum ('OWNER','ADMIN','ADVISOR','BACKOFFICE');
