-- Conversations: one row per (channel, channel_user_id) customer
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  display_name TEXT,
  started_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  paused_until INTEGER,
  open_ticket_id TEXT,
  metadata TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_unique ON conversations(channel, channel_user_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(last_message_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cached_input_tokens INTEGER,
  audio_seconds REAL,
  image_count INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_msg_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  name TEXT,
  contact TEXT,
  channel_user_id TEXT,
  intent TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'new',
  exported_to TEXT,
  external_id TEXT,
  -- JSON con campos propios del nicho (reservacion con fecha/hora/personas, o
  -- comprador con presupuesto/zona/operacion). El dashboard del nicho lee de aqui.
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  category TEXT,
  summary TEXT NOT NULL,
  transcript TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  resolved_at INTEGER,
  resolved_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS admin_emails (
  email TEXT PRIMARY KEY,
  role TEXT DEFAULT 'owner',
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_magic_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_expires ON magic_links(expires_at);

-- Settings: key/value overlay edited from the dashboard. Empty/absent => default.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- AI-generated quality analysis: one row per conversation, written by the
-- insights analyzer (Haiku) once the conversation goes idle. Re-analyzed if
-- the customer comes back (analyzed_at < last_message_at).
-- sentiment: positive | neutral | frustrated | angry
-- resolution: resolved | unresolved | escalated | abandoned
-- bot_score: 1-5 quality of the bot's replies · topics: JSON array (es)
-- summary: 1-2 sentences (es) · missed_kb: question the KB couldn't answer
-- sale_opportunity: 1 = open sale left on the table
CREATE TABLE IF NOT EXISTS conversation_insights (
  conversation_id TEXT PRIMARY KEY,
  analyzed_at INTEGER NOT NULL,
  sentiment TEXT,
  resolution TEXT,
  bot_score INTEGER,
  topics TEXT,
  summary TEXT,
  missed_kb TEXT,
  sale_opportunity INTEGER DEFAULT 0,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_insights_analyzed ON conversation_insights(analyzed_at);

-- Knowledge-base documents editable from the dashboard. Indexed into Vectorize
-- on save (chunked). The repo kb-fixtures.json remains a separate source.
-- NOTE: never put semicolons inside schema comments (the test helper splits on them).
CREATE TABLE IF NOT EXISTS kb_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Flywheel (F5) - every proposed self-improvement is a reviewable row.
-- kind: kb_entry | leccion. fingerprint dedupes across any status so a
-- dismissed suggestion is never re-proposed.
CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  payload TEXT NOT NULL,
  evidence TEXT,
  status TEXT DEFAULT 'proposed',
  created_at INTEGER NOT NULL,
  applied_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sugg_status ON improvement_suggestions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sugg_fp ON improvement_suggestions(kind, fingerprint);

-- Follow-up bot - one row per conversation that ever received a follow-up.
-- The PRIMARY KEY doubles as the send claim (INSERT OR IGNORE) so a
-- conversation can never get more than one follow-up, ever.
CREATE TABLE IF NOT EXISTS followup_sends (
  conversation_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);

-- Per-customer memory extracted by the insights analyzer. Injected into the
-- system context when the same customer writes again.
CREATE TABLE IF NOT EXISTS customer_facts (
  conversation_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  learned_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, fact)
);

-- Links de trackeo por conversación (código destino, con contador de clicks).
-- Un código por conversación y destino, alimenta la segmentación de campañas.
CREATE TABLE IF NOT EXISTS tracked_links (
  code TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  target TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  last_click_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tracked_links_conv ON tracked_links(conversation_id);

-- Hits de keywords (QUIERO / RECURSOS) — alimenta la segmentación de campañas
CREATE TABLE IF NOT EXISTS keyword_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_keyword_hits_kw ON keyword_hits(keyword);

-- Etiquetas por conversación (interés + objeción) para la segmentación de campañas.
-- La tabla se conserva para el módulo de campañas/segmentos.
CREATE TABLE IF NOT EXISTS conv_labels (
  conversation_id TEXT PRIMARY KEY,
  variant TEXT,
  interest TEXT,
  objection TEXT,
  summary TEXT,
  labeled_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_labels_interest ON conv_labels(interest);

-- Envíos de campañas (free-form dentro de ventana / plantilla HSM fuera)
-- El UNIQUE es el candado anti-doble-envío por campaña
CREATE TABLE IF NOT EXISTS template_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_key TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  template_sid TEXT,
  sent_at INTEGER NOT NULL,
  UNIQUE (campaign_key, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_template_sends_time ON template_sends(sent_at);

-- Kapso webhook idempotency ledger. Kapso may retry events, so an event key
-- is recorded before routing it into the conversation agent.
CREATE TABLE IF NOT EXISTS kapso_webhook_events (
  idempotency_key TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Estado breve del quiz conversacional Realtor por WhatsApp/Kapso.
CREATE TABLE IF NOT EXISTS realtor_intakes (
  conversation_id TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  name TEXT,
  contact TEXT,
  operation TEXT,
  area TEXT,
  budget TEXT,
  timeline TEXT,
  preapproved TEXT,
  updated_at INTEGER NOT NULL
);

-- Hawk Guru Realtor Suite: canonical CRM pipelines. These are deliberately
-- separate from the Starter lead.status enum so existing bots remain intact.
CREATE TABLE IF NOT EXISTS realtor_pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS realtor_pipeline_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0,
  is_won INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (pipeline_id) REFERENCES realtor_pipelines(id) ON DELETE CASCADE,
  UNIQUE (pipeline_id, position)
);
CREATE INDEX IF NOT EXISTS idx_realtor_stage_pipeline ON realtor_pipeline_stages(pipeline_id, position);

CREATE TABLE IF NOT EXISTS realtor_lead_pipeline (
  lead_id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  score_reason TEXT,
  source TEXT,
  next_action TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (pipeline_id) REFERENCES realtor_pipelines(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES realtor_pipeline_stages(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_realtor_lead_stage ON realtor_lead_pipeline(pipeline_id, stage_id, score);

CREATE TABLE IF NOT EXISTS realtor_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS realtor_lead_tags (
  lead_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (lead_id, tag_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES realtor_tags(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_realtor_tag_lead ON realtor_lead_tags(tag_id, lead_id);

CREATE TABLE IF NOT EXISTS realtor_pipeline_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_realtor_events_lead ON realtor_pipeline_events(lead_id, created_at DESC);

-- Open Houses: cada listing tiene token y QR propios. Los visitantes se atan
-- siempre al listing exacto para que nunca reciban seguimiento de otra propiedad.
CREATE TABLE IF NOT EXISTS open_houses (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  scheduled_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_open_houses_status ON open_houses(status, scheduled_at);

CREATE TABLE IF NOT EXISTS open_house_visitors (
  id TEXT PRIMARY KEY,
  open_house_id TEXT NOT NULL,
  lead_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  interest TEXT,
  created_at INTEGER NOT NULL,
  followup_due_at INTEGER NOT NULL,
  contacted_at INTEGER,
  FOREIGN KEY (open_house_id) REFERENCES open_houses(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_open_house_visitors_followup ON open_house_visitors(open_house_id, followup_due_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_open_house_visitor_unique ON open_house_visitors(open_house_id, phone);
