/**
 * ⚖️ Legal Aid USSD System — Tanzania (v5.0 PRODUCTION)
 * 
 * Enterprise-grade legal aid triage system.
 * 
 * ENDESHA: node server.js
 * FUNGUA: http://localhost:3000
 * 
 * @author Wewe
 * @version 5.0.0
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));

// ============================================================
// SECURITY HEADERS
// ============================================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'legal-aid-tanzania-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 30 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// ============================================================
// DATABASE (in-memory — production: PostgreSQL)
// ============================================================
const db = {
  cases: [],
  paralegals: [
    { id: 1, name: 'Asha Mwinyi',    phone: '+255700000001', region: 'Dar es Salaam', specializations: ['Ardhi', 'Ndoa'],     activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 2, name: 'John Mwakasege', phone: '+255700000002', region: 'Dodoma',        specializations: ['Ardhi', 'Ajira'],    activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 3, name: 'Fatuma Salum',   phone: '+255700000003', region: 'Mwanza',        specializations: ['Ndoa', 'Ukatili'],   activeCases: 0, maxCaseload: 4, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 4, name: 'Peter Kimaro',   phone: '+255700000004', region: 'Mbeya',         specializations: ['Ardhi'],             activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 5, name: 'Grace Mollel',   phone: '+255700000005', region: 'Arusha',        specializations: ['Ajira', 'Ndoa'],     activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 6, name: 'Hassan Juma',    phone: '+255700000006', region: 'Dar es Salaam', specializations: ['Ajira'],             activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 7, name: 'Neema Mushi',    phone: '+255700000007', region: 'Kilimanjaro',   specializations: ['Ukatili'],           activeCases: 0, maxCaseload: 3, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
    { id: 8, name: 'David Ngowi',    phone: '+255700000008', region: 'Tanga',         specializations: ['Ardhi', 'Nyingine'], activeCases: 0, maxCaseload: 5, active: true, onLeave: false, leaveUntil: null, blockedCategories: [], lastAssignedAt: null, casesResolved: 0 },
  ],
  users: [],
  sessions: {},
  auditLog: [],
  assignmentLog: [],
  loginAttempts: {},
  ussdCache: {},
  smsQueue: [],
  stats: {
    started: 0, completed: 0, usedSijui: 0, usedConfirmBack: 0, duplicatesBlocked: 0,
    byLanguage: { sw: 0, en: 0 },
    byRegion: {},
  },
};

// ============================================================
// SEED USERS
// ============================================================
function seedUsers() {
  const users = [
    { username: 'admin',     password: 'admin123',  role: 'admin',      name: 'Msimamizi Mkuu',    region: null,             paralegalId: null },
    { username: 'super',     password: 'super123',  role: 'supervisor', name: 'Supervisor DSM',    region: 'Dar es Salaam',  paralegalId: null },
    { username: 'super_dod', password: 'dod123',    role: 'supervisor', name: 'Supervisor Dodoma', region: 'Dodoma',         paralegalId: null },
    { username: 'super_mwz', password: 'mwz123',    role: 'supervisor', name: 'Supervisor Mwanza', region: 'Mwanza',         paralegalId: null },
    { username: 'asha',      password: 'asha123',   role: 'paralegal',  name: 'Asha Mwinyi',       region: 'Dar es Salaam',  paralegalId: 1 },
    { username: 'john',      password: 'john123',   role: 'paralegal',  name: 'John Mwakasege',    region: 'Dodoma',         paralegalId: 2 },
    { username: 'fatuma',    password: 'fatuma123', role: 'paralegal',  name: 'Fatuma Salum',      region: 'Mwanza',         paralegalId: 3 },
    { username: 'peter',     password: 'peter123',  role: 'paralegal',  name: 'Peter Kimaro',      region: 'Mbeya',          paralegalId: 4 },
    { username: 'grace',     password: 'grace123',  role: 'paralegal',  name: 'Grace Mollel',      region: 'Arusha',         paralegalId: 5 },
  ];
  users.forEach(u => {
    db.users.push({
      id: db.users.length + 1,
      username: u.username,
      passwordHash: bcrypt.hashSync(u.password, 10),
      role: u.role, name: u.name, region: u.region,
      paralegalId: u.paralegalId,
      active: true, createdAt: new Date(),
    });
  });
  console.log(`👥 Users seeded: ${db.users.length}`);
}
seedUsers();

// ============================================================
// CONSTANTS
// ============================================================
const REGIONS = {
  '1': { name: 'Dar es Salaam', code: 'DSM' },
  '2': { name: 'Dodoma',        code: 'DOD' },
  '3': { name: 'Mwanza',        code: 'MWZ' },
  '4': { name: 'Mbeya',         code: 'MBY' },
  '5': { name: 'Arusha',        code: 'ARK' },
  '6': { name: 'Kilimanjaro',   code: 'KLJ' },
  '7': { name: 'Tanga',         code: 'TNG' },
  '8': { name: 'Nyingine',      code: 'TZ'  },
};

// SLA kwa business hours
const BUSINESS_HOURS = {
  0: null,                          // Jumapili imefungwa
  1: { start: 8, end: 18 },         // Jumatatu
  2: { start: 8, end: 18 },
  3: { start: 8, end: 18 },
  4: { start: 8, end: 18 },
  5: { start: 8, end: 18 },
  6: { start: 9, end: 14 },         // Jumamosi
};

const SLA_CONFIG = {
  HIGH:   { value: 2, unit: 'business_hours' },   // 2 business hours
  MEDIUM: { value: 1, unit: 'business_days'  },   // 1 business day (8h)
  LOW:    { value: 3, unit: 'business_days'  },   // 3 business days
};

// Case state machine
const CASE_TRANSITIONS = {
  'imepokelewa':     ['inaendelea', 'imekataliwa'],
  'inaendelea':      ['inasubiri_mteja', 'imemalizika', 'imekataliwa'],
  'inasubiri_mteja': ['inaendelea', 'imekataliwa'],
  'imemalizika':     [],
  'imekataliwa':     ['imepokelewa'],
};

// ============================================================
// LUGHA
// ============================================================
const TEXT = {
  sw: {
    chooseLang: `Chagua lugha / Choose language:
1. Kiswahili
2. English`,
    menu: `Karibu Msaada wa Kisheria - BURE

Chagua namba ya tatizo lako:
1. Ardhi (shamba, nyumba)
2. Ndoa (talaka, mirathi)
3. Ajira (mshahara, kazi)
4. Ukatili (kupigwa, kutishiwa)
5. Fuatilia kesi yako
6. Sijui - nisaidie kuchagua`,
    confirm: (name, desc) => `Umechagua: ${name.toUpperCase()}
Hii inahusu ${desc}.

Ni sahihi?
1. Ndiyo, endelea
2. Hapana, nirudi nyuma`,
    askName: `Weka jina lako (jina la kwanza):
(au bonyeza 0 kuruka)`,
    askPhone: `Weka namba yako ya simu:
(mfano 0712345678)
(au 0 kutumia namba hii)`,
    invalidPhone: (val) => `Namba "${val}" si sahihi.
Weka namba 10 (mfano 0712345678)
au 0 kutumia namba hii.`,
    askRegion: `Chagua mkoa wako:
1. Dar es Salaam
2. Dodoma
3. Mwanza
4. Mbeya
5. Arusha
6. Kilimanjaro
7. Tanga
8. Nyingine`,
    thanksAll: (name, phone, region) => `Asante ${name}!
Simu: ${phone}
Mkoa: ${region}

Eleza tatizo lako kwa ufupi
(herufi 160 max):`,
    track: `Weka code ya kesi yako
(mfano DSM-2024-48291):`,
    caseNotFound: (code) => `Kesi ${code} haipatikani.
Angalia code na ujaribu tena.`,
    caseFound: (c, p) => `Kesi: ${c.caseCode}
Jina: ${c.name || 'Mteja'}
Aina: ${c.category}
Hali: ${c.status}
Paralegal: ${p ? p.name : 'Atapangwa'}
${formatDateSw(c.createdAt)}`,
    success: (name, code, cat, paralegal, phone, sla) => `Asante ${name}!
Kesi yako: ${code}
Aina: ${cat}
Simu: ${phone}
Paralegal: ${paralegal ? paralegal.name : 'Atapangwa'}
${sla ? `Tunatarajia kutatua ndani ya ${sla} masaa ya kazi.` : ''}
Utapigiwa simu hivi karibuni.`,
    duplicate: (code, status) => `Tunaona una kesi inayofanana:
Kesi: ${code}
Hali: ${status}

Unataka:
1. Kuongeza kwenye kesi ile
2. Kufungua kesi mpya`,
    wrongChoice: `Chaguo si sahihi. Jaribu tena.`,
    invalidName: `Jina linaonekana si sahihi.
Tafadhali weka jina lako halisi.`,
    invalidDesc: `Maelezo ni mafupi mno.
Tafadhali eleza tatizo kwa maneno zaidi.`,
    triage1: `Sawa. Nitakuuliza maswali mawili
ili nikuelekeze sawasawa.

Tatizo lako linahusu:
1. Mali (shamba, nyumba, fedha)
2. Familia (ndoa, watoto, mirathi)
3. Kazi (mshahara, mkataba)
4. Mwili wangu (kupigwa, kutishiwa)
5. Kitu kingine`,
    triageStep2: {
      '1': `Mali yako inahusu:
1. Shamba au ardhi
2. Nyumba
3. Fedha au deni
4. Mrithi wa mali`,
      '2': `Familia yako inahusu:
1. Ndoa (talaka, kutengana)
2. Watoto (malezi, ruzuku)
3. Mirathi (urithi)`,
      '3': `Kazi yako inahusu:
1. Mshahara
2. Kufukuzwa kazi
3. Mkataba`,
      '4': `Tatizo linahusu:
1. Kupigwa au kujeruhiwa
2. Kutishiwa
3. Unyanyasaji mwingine`,
      '5': `Kitu gani hasa?
1. Fedha
2. Mali
3. Nyingine`,
    },
    triageResult: (cat) => `Asante. Kesi yako ni ya ${cat.toUpperCase()}.

Weka jina lako (jina la kwanza):
(au bonyeza 0 kuruka)`,
  },
  en: {
    chooseLang: `Choose language / Chagua lugha:
1. Kiswahili
2. English`,
    menu: `Welcome to Legal Aid - FREE

Choose your problem number:
1. Land (farm, house)
2. Marriage (divorce, inheritance)
3. Work (salary, dismissal)
4. Violence (beaten, threatened)
5. Track your case
6. I don't know - help me choose`,
    confirm: (name, desc) => `You chose: ${name.toUpperCase()}
This covers ${desc}.

Is this correct?
1. Yes, continue
2. No, go back`,
    askName: `Enter your name (first name):
(or press 0 to skip)`,
    askPhone: `Enter your phone number:
(e.g. 0712345678)
(or 0 to use this number)`,
    invalidPhone: (val) => `Number "${val}" is invalid.
Enter 10 digits (e.g. 0712345678)
or 0 to use this number.`,
    askRegion: `Choose your region:
1. Dar es Salaam
2. Dodoma
3. Mwanza
4. Mbeya
5. Arusha
6. Kilimanjaro
7. Tanga
8. Other`,
    thanksAll: (name, phone, region) => `Thanks ${name}!
Phone: ${phone}
Region: ${region}

Describe your problem briefly
(160 chars max):`,
    track: `Enter your case code
(e.g. DSM-2024-48291):`,
    caseNotFound: (code) => `Case ${code} not found.`,
    caseFound: (c, p) => `Case: ${c.caseCode}
Name: ${c.name || 'Client'}
Type: ${c.category}
Status: ${c.status}
Paralegal: ${p ? p.name : 'Pending'}
${formatDateSw(c.createdAt)}`,
    success: (name, code, cat, paralegal, phone, sla) => `Thanks ${name}!
Case: ${code}
Type: ${cat}
Phone: ${phone}
Paralegal: ${paralegal ? paralegal.name : 'Pending'}
${sla ? `We aim to resolve within ${sla} business hours.` : ''}`,
    duplicate: (code, status) => `We found a similar case:
Case: ${code}
Status: ${status}

1. Add to existing case
2. Create new case`,
    wrongChoice: `Invalid choice. Try again.`,
    invalidName: `Name looks invalid. Please enter your real name.`,
    invalidDesc: `Description is too short. Please elaborate.`,
    triage1: `Okay. Two quick questions.

Your problem involves:
1. Property
2. Family
3. Work
4. My body
5. Something else`,
    triageStep2: {
      '1': `Property:
1. Farm/land
2. House
3. Money/debt
4. Inheritance`,
      '2': `Family:
1. Marriage
2. Children
3. Inheritance`,
      '3': `Work:
1. Salary
2. Dismissal
3. Contract`,
      '4': `Problem:
1. Physical harm
2. Threats
3. Other abuse`,
      '5': `What exactly?
1. Money
2. Property
3. Other`,
    },
    triageResult: (cat) => `Your case is ${cat.toUpperCase()}.

Enter your name:`,
  },
};

function T(lang, key, ...args) {
  const val = TEXT[lang]?.[key] ?? TEXT.sw[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ============================================================
// CATEGORIES
// ============================================================
const CATEGORIES = {
  '1': { name: 'Ardhi',               nameEn: 'Land',              priority: 'MEDIUM', desc: 'shamba, nyumba, mpaka',   descEn: 'farm, house, boundary' },
  '2': { name: 'Ndoa na Familia',     nameEn: 'Marriage & Family', priority: 'MEDIUM', desc: 'talaka, mirathi, watoto', descEn: 'divorce, inheritance, children' },
  '3': { name: 'Ajira',               nameEn: 'Work',              priority: 'MEDIUM', desc: 'mshahara, kufukuzwa',     descEn: 'salary, dismissal' },
  '4': { name: 'Ukatili wa Kijinsia', nameEn: 'Gender Violence',   priority: 'HIGH',   desc: 'kupigwa, kutishiwa',      descEn: 'beaten, threatened' },
  '6': { name: 'Nyingine',            nameEn: 'Other',             priority: 'LOW',    desc: 'kitu kingine',            descEn: 'something else' },
};

const TRIAGE_MAP = {
  '1-1': 'Ardhi', '1-2': 'Ardhi', '1-3': 'Nyingine', '1-4': 'Nyingine',
  '2-1': 'Ndoa na Familia', '2-2': 'Ndoa na Familia', '2-3': 'Ndoa na Familia',
  '3-1': 'Ajira', '3-2': 'Ajira', '3-3': 'Ajira',
  '4-1': 'Ukatili wa Kijinsia', '4-2': 'Ukatili wa Kijinsia', '4-3': 'Ukatili wa Kijinsia',
  '5-1': 'Nyingine', '5-2': 'Nyingine', '5-3': 'Nyingine',
};

// ============================================================
// HELPERS — BASIC
// ============================================================
function makeCaseCode(regionCode) {
  const year = new Date().getFullYear();
  let code, attempts = 0;
  do {
    const rand = Math.floor(10000 + Math.random() * 90000);
    code = `${regionCode}-${year}-${rand}`;
    if (++attempts > 100) throw new Error('Cannot generate unique code');
  } while (db.cases.some(c => c.caseCode === code));
  return code;
}

function sanitizeName(raw) {
  if (!raw) return null;
  let clean = raw.replace(/[^a-zA-Z\s'-]/g, '').trim().substring(0, 30);
  if (!clean || clean.length < 2) return null;
  return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function sanitizePhone(raw) {
  if (!raw) return null;
  let clean = raw.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (/^0\d{9}$/.test(clean)) clean = '255' + clean.substring(1);
  else if (/^\d{9}$/.test(clean)) clean = '255' + clean;
  else if (!/^255\d{9}$/.test(clean)) return null;
  if (/^\+255(0+|1+)$/.test('+' + clean)) return null; // fake numbers
  return '+' + clean;
}

function formatDateSw(date) {
  const d = new Date(date);
  const siku = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (siku === 0) return 'Leo';
  if (siku === 1) return 'Jana';
  return `Siku ${siku} zilizopita`;
}

// ============================================================
// VALIDATORS — Multi-layer
// ============================================================
const VALIDATORS = {
  name: (raw) => {
    if (!raw || raw.length < 2) return { ok: false, error: 'Jina ni fupi mno' };
    if (!/^[a-zA-Z\s'-]+$/.test(raw)) return { ok: false, error: 'Herufi zisizoruhusiwa' };
    const clean = sanitizeName(raw);
    if (!clean) return { ok: false, error: 'Jina si sahihi' };
    return { ok: true, value: clean };
  },
  description: (raw) => {
    if (!raw || raw.length < 10) return { ok: false, error: 'Maelezo ni mafupi mno' };
    if (raw.length > 160) return { ok: false, error: 'Maelezo ni marefu mno' };
    const words = raw.trim().split(/\s+/);
    if (words.length < 3) return { ok: false, error: 'Eleza kwa maneno zaidi' };
    if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(raw.replace(/\s/g, ''))) {
      return { ok: false, error: 'Maelezo hayaonekani sawa' };
    }
    return { ok: true, value: raw.trim() };
  },
  phone: (raw) => {
    if (raw === '0') return { ok: true, value: null };
    const cleaned = sanitizePhone(raw);
    if (!cleaned) return { ok: false, error: 'Namba si sahihi' };
    return { ok: true, value: cleaned };
  },
};

// ============================================================
// AUDIT & LOGGING
// ============================================================
function audit(user, action, target, details = '') {
  db.auditLog.push({
    id: db.auditLog.length + 1,
    userId: user?.id || null,
    username: user?.username || 'system',
    role: user?.role || 'system',
    region: user?.region || null,
    action, target, details,
    at: new Date(),
  });
  if (db.auditLog.length > 5000) db.auditLog.shift();
}

function logAssignment(caseCode, paralegal, reason, metadata = {}) {
  db.assignmentLog.push({
    id: db.assignmentLog.length + 1,
    caseCode,
    paralegalId: paralegal?.id || null,
    paralegalName: paralegal?.name || null,
    reason, metadata,
    at: new Date(),
  });
  if (db.assignmentLog.length > 1000) db.assignmentLog.shift();
}

// ============================================================
// BUSINESS HOURS — SLA
// ============================================================
function addBusinessHours(startDate, hours) {
  let current = new Date(startDate);
  let remaining = hours;
  let safety = 0;
  while (remaining > 0 && safety++ < 1000) {
    const schedule = BUSINESS_HOURS[current.getDay()];
    if (!schedule) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    const ch = current.getHours() + current.getMinutes() / 60;
    if (ch < schedule.start) { current.setHours(schedule.start, 0, 0, 0); continue; }
    if (ch >= schedule.end) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    const leftToday = schedule.end - ch;
    if (leftToday >= remaining) {
      current.setTime(current.getTime() + remaining * 3600000);
      remaining = 0;
    } else {
      remaining -= leftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
  }
  return current;
}

function getSLADeadline(createdAt, priority) {
  const config = SLA_CONFIG[priority] || SLA_CONFIG.LOW;
  const hours = config.unit === 'business_days' ? config.value * 8 : config.value;
  return addBusinessHours(createdAt, hours);
}

function getSLAStatus(c) {
  if (c.status === 'imemalizika') return 'resolved';
  if (c.paused) return 'paused';
  const deadline = getSLADeadline(c.createdAt, c.priority);
  const total = deadline - c.createdAt.getTime();
  const elapsed = Date.now() - c.createdAt.getTime();
  const percent = elapsed / total;
  if (percent >= 1) return 'breached';
  if (percent >= 0.8) return 'critical';
  if (percent >= 0.5) return 'warning';
  return 'on_track';
}

function getSLARemainingText(c) {
  if (c.status === 'imemalizika') return 'Imemalizika';
  if (c.paused) return 'Imesimama';
  const deadline = getSLADeadline(c.createdAt, c.priority);
  const remaining = deadline - Date.now();
  if (remaining < 0) {
    const h = Math.floor(-remaining / 3600000);
    return `Imechelewa ${h}h`;
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  if (h > 0) return `Saa ${h}h`;
  return `Dakika ${m}m`;
}

function recordSLAEvent(c, event, metadata = {}) {
  if (!c.slaHistory) c.slaHistory = [];
  c.slaHistory.push({ event, at: new Date(), status: getSLAStatus(c), ...metadata });
}

// ============================================================
// ASSIGNMENT — 5-tier deterministic
// ============================================================
function assignParalegal(category, priority, region, caseCode) {
  const now = Date.now();

  // TIER 1: Filter ineligible
  const candidates = db.paralegals.filter(p => {
    if (!p.active) return false;
    if (p.activeCases >= p.maxCaseload) return false;
    if (p.onLeave && p.leaveUntil && p.leaveUntil > now) return false;
    if (p.blockedCategories?.includes(category)) return false;
    return true;
  });

  if (!candidates.length) {
    logAssignment(caseCode, null, 'NO_CANDIDATES', { region, category, priority });
    return { paralegal: null, reason: 'NO_ELIGIBLE_PARALEGAL', score: 0 };
  }

  // TIER 2-4: Score
  const scored = candidates.map(p => {
    const score = {
      regionMatch: p.region === region ? 30 : 0,
      specialty: p.specializations.includes(category) ? 20 : 0,
      highPriority: priority === 'HIGH' && p.specializations.includes('Ukatili') ? 25 : 0,
      availability: (p.maxCaseload - p.activeCases) * 5,
      experience: (p.casesResolved || 0) * 0.5,
      recency: p.lastAssignedAt ? Math.min((now - p.lastAssignedAt) / 3600000, 100) : 100,
    };
    const total = Object.values(score).reduce((s, v) => s + v, 0);
    return { paralegal: p, score, total };
  });

  // TIER 5: Deterministic tie-breaker
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aLast = a.paralegal.lastAssignedAt?.getTime() || 0;
    const bLast = b.paralegal.lastAssignedAt?.getTime() || 0;
    return aLast - bLast;
  });

  const winner = scored[0];
  logAssignment(caseCode, winner.paralegal, 'ASSIGNED', {
    score: winner.total, breakdown: winner.score,
    candidatesConsidered: candidates.length,
    runnersUp: scored.slice(1, 3).map(s => ({ name: s.paralegal.name, score: s.total })),
  });

  return { paralegal: winner.paralegal, reason: 'BEST_SCORE', score: winner.total, breakdown: winner.score };
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================
function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (!setA.size || !setB.size) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function detectDuplicate(phone, category, description) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600000;
  const recent = db.cases.filter(c => {
    if (c.phone !== phone) return false;
    if (c.createdAt.getTime() < sevenDaysAgo) return false;
    if (c.status === 'imemalizika' || c.status === 'imekataliwa') return false;
    return true;
  });

  for (const c of recent) {
    const sameCategory = c.category === category;
    const similarity = jaccardSimilarity(c.description, description);
    if (sameCategory && similarity > 0.7) {
      return { duplicate: true, existingCase: c, similarity: Math.round(similarity * 100) };
    }
  }
  return { duplicate: false };
}

// ============================================================
// STATE MACHINE
// ============================================================
function canTransition(from, to) {
  return CASE_TRANSITIONS[from]?.includes(to) || false;
}

function transitionCase(caseId, newStatus, user, reason = '') {
  const c = db.cases.find(x => x.id === caseId);
  if (!c) return { ok: false, error: 'Case not found' };
  if (c.status === newStatus) return { ok: false, error: 'Same status' };
  if (!canTransition(c.status, newStatus)) {
    return { ok: false, error: `Haiwezi kutoka ${c.status} kwenda ${newStatus}` };
  }
  if (newStatus === 'imemalizika' && user.role === 'paralegal') {
    const hasResolution = c.notes?.some(n => n.type === 'resolution');
    if (!hasResolution) return { ok: false, error: 'Andika resolution kwanza' };
  }

  const old = c.status;
  c.status = newStatus;
  c.updatedAt = new Date();
  c.notes.push({
    type: 'status_change',
    text: `${old} → ${newStatus}${reason ? `: ${reason}` : ''}`,
    by: user.name,
    at: new Date(),
  });
  recordSLAEvent(c, 'status_change', { from: old, to: newStatus });

  if (newStatus === 'imemalizika' && c.paralegalId) {
    const p = db.paralegals.find(x => x.id === c.paralegalId);
    if (p) {
      if (p.activeCases > 0) p.activeCases--;
      p.casesResolved = (p.casesResolved || 0) + 1;
      p.lastAssignedAt = new Date();
    }
  }

  audit(user, 'update_case', c.caseCode, `${old} → ${newStatus}`);
  return { ok: true };
}

// ============================================================
// SMS QUEUE
// ============================================================
function queueSMS(phone, message, options = {}) {
  const { priority = 'normal', maxRetries = 3 } = options;
  db.smsQueue.push({
    id: db.smsQueue.length + 1,
    phone, message, priority, maxRetries,
    attempts: 0, status: 'pending',
    createdAt: new Date(), sentAt: null, error: null,
  });
  if (priority === 'urgent') processSMSQueue();
}

function processSMSQueue() {
  const pending = db.smsQueue
    .filter(s => s.status === 'pending' && s.attempts < s.maxRetries)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
      return a.createdAt - b.createdAt;
    });

  for (const sms of pending) {
    try {
      console.log(`📱 [SMS → ${sms.phone}] ${sms.message}`);
      sms.status = 'sent';
      sms.sentAt = new Date();
    } catch (err) {
      sms.attempts++;
      sms.error = err.message;
      if (sms.attempts >= sms.maxRetries) {
        sms.status = 'failed';
        audit(null, 'sms_failed', sms.phone, err.message);
      }
    }
  }
}

setInterval(processSMSQueue, 60000);

// ============================================================
// PRIVACY SCOPING
// ============================================================
function scopeCases(user) {
  if (!user) return [];
  if (user.role === 'admin') return db.cases;
  if (user.role === 'supervisor') return db.cases.filter(c => c.region === user.region);
  if (user.role === 'paralegal') return db.cases.filter(c => c.paralegalId === user.paralegalId);
  return [];
}

function canAccessCase(user, c) {
  if (!user || !c) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'supervisor') return c.region === user.region;
  if (user.role === 'paralegal') return c.paralegalId === user.paralegalId;
  return false;
}

function scopeParalegals(user) {
  if (!user) return [];
  if (user.role === 'admin') return db.paralegals;
  if (user.role === 'supervisor') return db.paralegals.filter(p => p.region === user.region);
  if (user.role === 'paralegal') return db.paralegals.filter(p => p.id === user.paralegalId);
  return [];
}

function scopeUsers(user) {
  if (!user) return [];
  if (user.role === 'admin') return db.users;
  if (user.role === 'supervisor') return db.users.filter(u => u.region === user.region || u.id === user.id);
  return db.users.filter(u => u.id === user.id);
}

function scopeAuditLog(user) {
  if (!user) return [];
  if (user.role === 'admin') return db.auditLog;
  if (user.role === 'supervisor') {
    const ids = db.users.filter(u => u.region === user.region).map(u => u.id);
    return db.auditLog.filter(l => ids.includes(l.userId) || l.userId === user.id);
  }
  return db.auditLog.filter(l => l.userId === user.id);
}

// ============================================================
// MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  req.user = req.session.user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      audit(req.user, 'access_denied', req.originalUrl, `Role: ${req.user.role}`);
      return res.status(403).send(forbiddenPage('Hauna ruhusa kufikia ukurasa huu.'));
    }
    next();
  };
}

// ============================================================
// RATE LIMITING
// ============================================================
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function checkRateLimit(ip) {
  const rec = db.loginAttempts[ip];
  if (!rec) return { allowed: true };
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return { allowed: false, until: rec.lockedUntil };
  return { allowed: true };
}

function recordFailedAttempt(ip) {
  if (!db.loginAttempts[ip]) db.loginAttempts[ip] = { count: 0 };
  db.loginAttempts[ip].count++;
  if (db.loginAttempts[ip].count >= MAX_ATTEMPTS) {
    db.loginAttempts[ip].lockedUntil = Date.now() + LOCKOUT_MS;
    db.loginAttempts[ip].count = 0;
  }
}

// ============================================================
// IDEMPOTENCY — USSD cache
// ============================================================
function ussdIdempotent(phoneNumber, text, handler) {
  const key = `${phoneNumber}:${text}`;
  const cached = db.ussdCache[key];
  if (cached && Date.now() - cached.at < 60000) return cached.response;
  const response = handler();
  db.ussdCache[key] = { response, at: Date.now() };
  setTimeout(() => { if (db.ussdCache[key]?.at === db.ussdCache[key]?.at) delete db.ussdCache[key]; }, 60000);
  return response;
}

// ============================================================
// ATOMIC CASE CREATION
// ============================================================
function createCaseAtomic(caseData) {
  const backupCases = [...db.cases];
  const backupParalegals = JSON.parse(JSON.stringify(db.paralegals));

  try {
    const newCase = { ...caseData, id: db.cases.length + 1 };
    db.cases.push(newCase);

    if (caseData.paralegalId) {
      const p = db.paralegals.find(x => x.id === caseData.paralegalId);
      if (!p) throw new Error('Paralegal not found');
      p.activeCases++;
      p.lastAssignedAt = new Date();
    }

    audit(null, 'case_created', newCase.caseCode, `Assigned: ${caseData.paralegalId || 'none'}`);
    return { ok: true, case: newCase };
  } catch (err) {
    db.cases = backupCases;
    db.paralegals = backupParalegals;
    console.error('Case creation failed:', err);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// ESCALATION CHECKER
// ============================================================
function checkEscalations() {
  db.cases.forEach(c => {
    if (c.status === 'imemalizika' || c.paused) return;
    const status = getSLAStatus(c);

    if (status === 'breached' && !c.escalated) {
      c.escalated = true;
      c.escalatedAt = new Date();
      recordSLAEvent(c, 'breached', { escalatedTo: 'supervisor' });
      const p = db.paralegals.find(x => x.id === c.paralegalId);
      if (p) queueSMS(p.phone, `⚠️ Kesi ${c.caseCode} imechelewa. Angalia haraka.`, { priority: 'urgent' });
      audit(null, 'sla_breached', c.caseCode, `Priority: ${c.priority}`);
    }
    if (status === 'critical' && !c.warned) {
      c.warned = true;
      recordSLAEvent(c, 'critical_warning');
    }
  });
}
setInterval(checkEscalations, 5 * 60 * 1000);

// ============================================================
// FINALIZE CASE (with duplicate check)
// ============================================================
function finalizeCase(ussdPhone, session, description, lang) {
  // Check duplicate
  const dup = detectDuplicate(session.phone || ussdPhone, session.category, description);
  if (dup.duplicate && !session.ignoreDuplicate) {
    db.stats.duplicatesBlocked++;
    session.pendingCase = { description };
    session.duplicateCaseCode = dup.existingCase.caseCode;
    return {
      response: `CON ${T(lang, 'duplicate', dup.existingCase.caseCode, dup.existingCase.status)}`,
      step: 'duplicate_choice',
    };
  }

  const region = session.region || 'Nyingine';
  const regionCode = Object.entries(REGIONS).find(([, v]) => v.name === region)?.[1].code || 'TZ';
  const caseCode = makeCaseCode(regionCode);
  const contactPhone = session.phone || ussdPhone;

  const assignment = assignParalegal(session.category, session.priority, region, caseCode);
  const paralegal = assignment.paralegal;

  const newCaseData = {
    caseCode,
    name: session.name || 'Mteja',
    phone: contactPhone,
    ussdPhone,
    region,
    category: session.category,
    categoryKey: session.categoryKey,
    description,
    priority: session.priority,
    status: 'imepokelewa',
    paralegalId: paralegal ? paralegal.id : null,
    lang,
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: [
      { type: 'created', text: `${session.name} amefungua kesi`, by: 'system', at: new Date() },
      { type: 'assigned', text: paralegal ? `Imepangwa kwa ${paralegal.name} (${assignment.reason}, score ${assignment.score})` : 'Hakuna paralegal', by: 'system', at: new Date() },
    ],
    slaHistory: [{ event: 'created', at: new Date(), status: 'on_track' }],
  };

  const result = createCaseAtomic(newCaseData);
  if (!result.ok) {
    return { response: `END Hitilafu ya mfumo. Jaribu tena.`, step: 'done' };
  }

  db.stats.byRegion[region] = (db.stats.byRegion[region] || 0) + 1;
  db.stats.completed++;

  if (paralegal) {
    queueSMS(paralegal.phone, `Kesi mpya: ${caseCode} (${session.category}, ${session.priority}). Mteja: ${session.name} (${contactPhone}). Mkoa: ${region}.`, { priority: session.priority === 'HIGH' ? 'urgent' : 'normal' });
  }
  queueSMS(contactPhone, `Asante ${session.name}. Kesi ${caseCode} imepokelewa. Paralegal: ${paralegal ? paralegal.name : 'Atapangwa'}.`, { priority: session.priority === 'HIGH' ? 'urgent' : 'normal' });

  const slaHours = SLA_CONFIG[session.priority].value;
  return {
    response: `END ${T(lang, 'success', session.name, caseCode, session.category, paralegal, contactPhone, slaHours)}`,
    step: 'done',
  };
}

// ============================================================
// USSD HANDLER (with idempotency)
// ============================================================
app.post('/ussd', (req, res) => {
  const { phoneNumber, text } = req.body;
  const sessionId = req.body.sessionId || 'default';

  const response = ussdIdempotent(phoneNumber, `${sessionId}:${text}`, () => {
    return processUSSD(phoneNumber, text);
  });

  res.set('Content-Type', 'text/plain');
  res.send(response);
});

function processUSSD(phoneNumber, text) {
  const parts = text ? text.split('*') : [];
  const lastInput = parts.length > 0 ? parts[parts.length - 1] : '';
  let session = db.sessions[phoneNumber];

  if (!session) {
    db.stats.started++;
    session = { step: 'lang', lang: null };
    db.sessions[phoneNumber] = session;
    return `CON ${TEXT.sw.chooseLang}`;
  }

  const lang = session.lang || 'sw';

  if (session.step === 'lang') {
    if (lastInput === '1') { session.lang = 'sw'; db.stats.byLanguage.sw++; session.step = 'menu'; return `CON ${T('sw', 'menu')}`; }
    if (lastInput === '2') { session.lang = 'en'; db.stats.byLanguage.en++; session.step = 'menu'; return `CON ${T('en', 'menu')}`; }
    return `CON ${TEXT.sw.chooseLang}`;
  }

  if (session.step === 'menu') {
    if (lastInput === '5') { session.step = 'track'; return `CON ${T(lang, 'track')}`; }
    if (lastInput === '6') { db.stats.usedSijui++; session.step = 'triage1'; return `CON ${T(lang, 'triage1')}`; }
    if (CATEGORIES[lastInput]) {
      const cat = CATEGORIES[lastInput];
      session.step = 'confirm';
      session.categoryKey = lastInput;
      session.category = lang === 'en' ? cat.nameEn : cat.name;
      session.priority = cat.priority;
      const desc = lang === 'en' ? cat.descEn : cat.desc;
      return `CON ${T(lang, 'confirm', session.category, desc)}`;
    }
    return `CON ${T(lang, 'wrongChoice')}\n\n${T(lang, 'menu')}`;
  }

  if (session.step === 'confirm') {
    if (lastInput === '1') { session.step = 'name'; return `CON ${T(lang, 'askName')}`; }
    if (lastInput === '2') { db.stats.usedConfirmBack++; session.step = 'menu'; return `CON ${T(lang, 'menu')}`; }
    return `CON ${T(lang, 'wrongChoice')}`;
  }

  if (session.step === 'triage1') {
    const opts = T(lang, 'triageStep2');
    if (opts[lastInput]) { session.triage1 = lastInput; session.step = 'triage2'; return `CON ${opts[lastInput]}`; }
    return `CON ${T(lang, 'wrongChoice')}\n\n${T(lang, 'triage1')}`;
  }

  if (session.step === 'triage2') {
    const key = `${session.triage1}-${lastInput}`;
    const categoryName = TRIAGE_MAP[key];
    if (!categoryName) return `CON ${T(lang, 'wrongChoice')}\n\n${T(lang, 'triageStep2')[session.triage1]}`;
    const catEntry = Object.entries(CATEGORIES).find(([, v]) => v.name === categoryName);
    const categoryKey = catEntry ? catEntry[0] : '6';
    const cat = CATEGORIES[categoryKey];
    session.categoryKey = categoryKey;
    session.category = lang === 'en' ? cat.nameEn : cat.name;
    session.priority = cat.priority;
    session.step = 'name';
    return `CON ${T(lang, 'triageResult', session.category)}`;
  }

  if (session.step === 'name') {
    const v = VALIDATORS.name(lastInput === '0' ? '' : lastInput);
    if (lastInput === '0') {
      session.name = 'Mteja';
      session.step = 'phone';
      return `CON ${T(lang, 'askPhone')}`;
    }
    if (!v.ok) return `CON ${T(lang, 'invalidName')}\n\n${T(lang, 'askName')}`;
    session.name = v.value;
    session.step = 'phone';
    return `CON ${T(lang, 'askPhone')}`;
  }

  if (session.step === 'phone') {
    const v = VALIDATORS.phone(lastInput);
    if (!v.ok) return `CON ${T(lang, 'invalidPhone', lastInput)}\n\n${T(lang, 'askPhone')}`;
    session.phone = v.value || phoneNumber;
    session.step = 'region';
    return `CON ${T(lang, 'askRegion')}`;
  }

  if (session.step === 'region') {
    if (!REGIONS[lastInput]) return `CON ${T(lang, 'wrongChoice')}\n\n${T(lang, 'askRegion')}`;
    session.region = REGIONS[lastInput].name;
    session.step = 'describe';
    return `CON ${T(lang, 'thanksAll', session.name, session.phone, session.region)}`;
  }

  if (session.step === 'describe') {
    const v = VALIDATORS.description(lastInput);
    if (!v.ok) return `CON ${T(lang, 'invalidDesc')}\n\n${T(lang, 'thanksAll', session.name, session.phone, session.region)}`;
    const result = finalizeCase(phoneNumber, session, v.value, lang);
    if (result.step === 'done') delete db.sessions[phoneNumber];
    else session.step = result.step;
    return result.response;
  }

  if (session.step === 'duplicate_choice') {
    if (lastInput === '1') {
      // Ongeza kwenye kesi iliyopo
      const existing = db.cases.find(c => c.caseCode === session.duplicateCaseCode);
      if (existing && session.pendingCase) {
        existing.notes.push({
          type: 'note',
          text: `Mteja ameongeza maelezo: ${session.pendingCase.description}`,
          by: 'system', at: new Date(),
        });
        existing.updatedAt = new Date();
        queueSMS(existing.phone, `Maelezo yako yameongezwa kwenye kesi ${existing.caseCode}.`, { priority: 'normal' });
      }
      delete db.sessions[phoneNumber];
      return `END Asante. Maelezo yameongezwa kwenye kesi ${session.duplicateCaseCode}.`;
    }
    // Kesi mpya
    session.ignoreDuplicate = true;
    session.step = 'describe';
    const description = session.pendingCase?.description || 'N/A';
    const result = finalizeCase(phoneNumber, session, description, lang);
    delete db.sessions[phoneNumber];
    return result.response;
  }

  if (session.step === 'track') {
    const caseCode = lastInput.trim().toUpperCase();
    const found = db.cases.find(c => c.caseCode === caseCode);
    let response;
    if (!found) response = `END ${T(lang, 'caseNotFound', caseCode)}`;
    else {
      const p = db.paralegals.find(x => x.id === found.paralegalId);
      response = `END ${T(lang, 'caseFound', found, p)}`;
    }
    delete db.sessions[phoneNumber];
    return response;
  }

  delete db.sessions[phoneNumber];
  return `END ${T(lang, 'wrongChoice')}`;
}

// ============================================================
// FORBIDDEN PAGE
// ============================================================
function forbiddenPage(message) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>403</title>
<style>body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;padding:4rem;text-align:center;}
h1{color:#ff2d55;font-size:4rem;margin-bottom:1rem;}p{color:#888;margin-bottom:2rem;}
a{color:#ff2d55;text-decoration:none;font-weight:600;}</style></head>
<body><h1>🔒 403</h1><p>${message}</p><p><a href="/dashboard">Rudi Dashboard</a></p></body></html>`;
}

// ============================================================
// LOGIN
// ============================================================
app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/dashboard');
  res.send(loginPage(req.query.error || '', req.query.next || '/dashboard'));
});

app.post('/login', (req, res) => {
  const { username, password, next } = req.body;
  const ip = req.ip;
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.until - Date.now()) / 60000);
    return res.redirect('/login?error=' + encodeURIComponent(`Umezuiwa kwa dakika ${mins}.`));
  }
  const user = db.users.find(u => u.username === username && u.active);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    recordFailedAttempt(ip);
    audit(null, 'login_failed', username, `IP: ${ip}`);
    return res.redirect('/login?error=' + encodeURIComponent('Jina au password si sahihi.') + '&next=' + encodeURIComponent(next || '/dashboard'));
  }
  delete db.loginAttempts[ip];
  req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role, region: user.region, paralegalId: user.paralegalId };
  audit(req.session.user, 'login', user.username, `IP: ${ip}`);
  res.redirect(next || '/dashboard');
});

app.get('/logout', (req, res) => {
  if (req.session?.user) audit(req.session.user, 'logout', req.session.user.username);
  req.session.destroy(() => res.redirect('/login'));
});

function loginPage(error, next) {
  return `<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Ingia</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;}
.box{max-width:420px;width:100%;background:#111;border:1px solid #1f1f1f;border-radius:20px;padding:2.5rem;}
h1{font-size:1.6rem;margin-bottom:.5rem;text-align:center;}h1 span{color:#ff2d55;}
.sub{color:#888;font-size:.85rem;text-align:center;margin-bottom:2rem;}
label{display:block;font-size:.8rem;color:#888;margin-bottom:.5rem;text-transform:uppercase;}
input{width:100%;padding:1rem;font-size:1rem;background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:10px;outline:none;margin-bottom:1.2rem;}
input:focus{border-color:#ff2d55;}
button{width:100%;padding:1rem;background:#ff2d55;color:#fff;border:none;border-radius:10px;font-weight:700;font-size:1rem;cursor:pointer;}
button:hover{background:#e02048;}
.error{background:#440011;color:#ff5577;padding:1rem;border-radius:10px;margin-bottom:1.5rem;font-size:.85rem;text-align:center;}
.hint{background:#1a1200;border:1px solid #332200;border-radius:10px;padding:1rem;margin-top:1.5rem;font-size:.75rem;color:#ffaa00;line-height:1.6;}
.hint code{background:#000;padding:.15rem .4rem;border-radius:4px;color:#ff6b8a;font-size:.7rem;}</style></head>
<body><div class="box"><h1>⚖️ Msaada wa <span>Kisheria</span></h1>
<p class="sub">Ingia kwenye Dashboard</p>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/login">
<input type="hidden" name="next" value="${next}" />
<label>Jina la Mtumiaji</label>
<input type="text" name="username" required autofocus />
<label>Password</label>
<input type="password" name="password" required />
<button type="submit">Ingia</button>
</form>
<div class="hint"><strong>Demo accounts:</strong><br>
Admin: <code>admin/admin123</code><br>
Supervisor DSM: <code>super/super123</code><br>
Supervisor Dodoma: <code>super_dod/dod123</code><br>
Paralegal: <code>asha/asha123</code></div>
</div></body></html>`;
}

// ============================================================
// DASHBOARD
// ============================================================
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.user;
  const cases = scopeCases(user);
  const paralegals = scopeParalegals(user);
  audit(user, 'view_dashboard', 'dashboard', `Cases: ${cases.length}`);
  res.send(dashboardPage(user, cases, paralegals));
});

function dashboardPage(user, cases, paralegals) {
  const total = cases.length;
  const resolved = cases.filter(c => c.status === 'imemalizika').length;
  const pending = cases.filter(c => c.status === 'imepokelewa').length;
  const inProgress = cases.filter(c => c.status === 'inaendelea').length;
  const breached = cases.filter(c => getSLAStatus(c) === 'breached').length;
  const critical = cases.filter(c => getSLAStatus(c) === 'critical').length;
  const canManageUsers = user.role === 'admin' || user.role === 'supervisor';

  const casesRows = cases.length === 0
    ? `<tr><td colspan="11" class="empty">Hakuna kesi bado.</td></tr>`
    : cases.slice().reverse().map(c => {
        const p = db.paralegals.find(x => x.id === c.paralegalId);
        const slaStatus = getSLAStatus(c);
        const slaText = getSLARemainingText(c);
        const notesCount = c.notes ? c.notes.length : 0;
        return `<tr>
          <td><strong>${c.caseCode}</strong></td>
          <td>${c.name || '—'}</td>
          <td>${c.phone}</td>
          <td>${c.region || '—'}</td>
          <td>${c.category}</td>
          <td><span class="badge ${c.priority.toLowerCase()}">${c.priority}</span></td>
          <td><span class="sla ${slaStatus}">${slaText}</span></td>
          <td>${p ? p.name : '—'}</td>
          <td><span class="badge ${c.status}">${c.status}</span></td>
          <td>
            <form method="POST" action="/dashboard/update/${c.id}" style="display:inline;">
              <select name="status">
                <option value="imepokelewa" ${c.status === 'imepokelewa' ? 'selected' : ''}>Imepokelewa</option>
                <option value="inaendelea" ${c.status === 'inaendelea' ? 'selected' : ''}>Inaendelea</option>
                <option value="inasubiri_mteja" ${c.status === 'inasubiri_mteja' ? 'selected' : ''}>Inasubiri</option>
                <option value="imemalizika" ${c.status === 'imemalizika' ? 'selected' : ''}>Imemalizika</option>
                <option value="imekataliwa" ${c.status === 'imekataliwa' ? 'selected' : ''}>Imekataliwa</option>
              </select>
              <button type="submit">✓</button>
            </form>
          </td>
          <td><a href="/dashboard/case/${c.id}" class="view-btn">👁 ${notesCount}</a></td>
        </tr>`;
      }).join('');

  const paralegalsRows = paralegals.length === 0
    ? `<tr><td colspan="5" class="empty">Hakuna paralegals.</td></tr>`
    : paralegals.map(p => `<tr>
        <td>${p.name}</td>
        <td>${p.region}</td>
        <td>${p.specializations.join(', ')}</td>
        <td>${p.activeCases} / ${p.maxCaseload}</td>
        <td><div class="bar"><div class="fill" style="width:${(p.activeCases / p.maxCaseload) * 100}%"></div></div></td>
      </tr>`).join('');

  return `<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Dashboard — ${user.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:2rem;}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;}
h1{font-size:1.8rem;font-weight:800;}h1 span{color:#ff2d55;}
.subtitle{color:#888;font-size:.9rem;margin-top:.3rem;}
.user-info{text-align:right;font-size:.85rem;}
.user-info strong{display:block;}
.user-info .role{color:#ff2d55;font-size:.75rem;text-transform:uppercase;}
.user-info .region{color:#00aaff;font-size:.7rem;}
.logout{background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;padding:.5rem 1rem;border-radius:8px;text-decoration:none;font-size:.8rem;}
.logout:hover{background:#ff2d55;}
.banner{border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.85rem;}
.banner.admin{background:#332200;border:1px solid #664400;color:#ffcc44;}
.banner.scoped{background:#002244;border:1px solid #003366;color:#66ccff;}
.nav{margin-bottom:1.5rem;}
.nav a{color:#ff2d55;text-decoration:none;margin-right:1rem;font-size:.9rem;font-weight:600;}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem;}
.stat{background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:1.5rem;}
.stat.alert{border-color:#ff2d55;background:#1a0008;}
.stat.crit{border-color:#ff5500;background:#1a0800;}
.stat.warn{border-color:#ffaa00;background:#1a1200;}
.stat-label{color:#888;font-size:.75rem;text-transform:uppercase;}
.stat-value{font-size:2.5rem;font-weight:800;color:#ff2d55;margin-top:.5rem;}
h2{font-size:1.1rem;margin:2rem 0 1rem;}
table{width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden;font-size:.82rem;}
th{background:#1a1a1a;color:#888;text-transform:uppercase;font-size:.7rem;padding:.9rem 1rem;text-align:left;}
td{padding:.9rem 1rem;border-bottom:1px solid #1a1a1a;}
tr:hover{background:#161616;}
.badge{padding:.25rem .6rem;border-radius:100px;font-size:.7rem;font-weight:700;}
.badge.imepokelewa{background:#332200;color:#ffaa00;}
.badge.inaendelea{background:#002244;color:#00aaff;}
.badge.inasubiri_mteja{background:#1a1a1a;color:#aaa;}
.badge.imemalizika{background:#003300;color:#00ff66;}
.badge.imekataliwa{background:#440011;color:#ff5577;}
.badge.high{background:#440011;color:#ff5577;}
.badge.medium{background:#332200;color:#ffaa00;}
.badge.low{background:#1a1a1a;color:#888;}
.sla{padding:.25rem .6rem;border-radius:6px;font-size:.7rem;font-weight:700;}
.sla.on_track{background:#002211;color:#00ff88;}
.sla.warning{background:#332200;color:#ffaa00;}
.sla.critical{background:#331a00;color:#ff7700;}
.sla.breached{background:#440011;color:#ff5577;animation:pulse 1.5s infinite;}
.sla.paused{background:#1a1a1a;color:#666;}
.sla.resolved{background:#0a0a0a;color:#666;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
select,button,.view-btn{background:#1a1a1a;color:#fff;border:1px solid #2a2a2a;padding:.4rem .6rem;border-radius:6px;font-size:.75rem;cursor:pointer;text-decoration:none;}
button:hover,.view-btn:hover{background:#ff2d55;}
.bar{background:#1a1a1a;height:8px;border-radius:100px;overflow:hidden;width:100px;}
.fill{background:linear-gradient(90deg,#ff2d55,#ff6b8a);height:100%;}
.empty{text-align:center;color:#666;padding:3rem;}
</style></head><body>

<div class="header">
  <div><h1>⚖️ Msaada wa <span>Kisheria</span></h1>
    <div class="subtitle">Dashboard — Tanzania · v5.0 PRODUCTION</div></div>
  <div style="display:flex;align-items:center;gap:1rem;">
    <div class="user-info">
      <strong>${user.name}</strong>
      <span class="role">${user.role}</span>
      ${user.region ? `<span class="region">📍 ${user.region}</span>` : ''}
    </div>
    <a href="/logout" class="logout">Toka</a>
  </div>
</div>

${user.role === 'admin'
  ? `<div class="banner admin">👑 <strong>Admin Access:</strong> Unaona kesi zote za Tanzania.</div>`
  : `<div class="banner scoped">🔒 <strong>Data Isolation:</strong> Unaona ${user.role === 'supervisor' ? `kesi za mkoa wa <strong>${user.region}</strong>` : 'kesi zako tu'}.</div>`
}

<div class="nav">
  <a href="/dashboard">Kesi</a>
  <a href="/api/metrics">Metrics</a>
  <a href="/api/performance">Performance</a>
  <a href="/audit">Audit</a>
  ${canManageUsers ? `<a href="/dashboard/users">Watumiaji</a>` : ''}
</div>

<div class="stats">
  <div class="stat"><div class="stat-label">Jumla</div><div class="stat-value">${total}</div></div>
  <div class="stat"><div class="stat-label">Zinasubiri</div><div class="stat-value">${pending}</div></div>
  <div class="stat"><div class="stat-label">Zinaendelea</div><div class="stat-value">${inProgress}</div></div>
  <div class="stat"><div class="stat-label">Zimemalizika</div><div class="stat-value">${resolved}</div></div>
</div>

<div class="stats">
  <div class="stat ${breached > 0 ? 'alert' : ''}"><div class="stat-label">🚨 Zimechelewa (SLA)</div><div class="stat-value">${breached}</div></div>
  <div class="stat ${critical > 0 ? 'crit' : ''}"><div class="stat-label">⚠️ Hatari (80%+)</div><div class="stat-value">${critical}</div></div>
</div>

<h2>📋 Kesi ${user.role === 'admin' ? '(Zote)' : user.role === 'supervisor' ? `(Mkoa: ${user.region})` : '(Zangu)'}</h2>
<table><thead><tr>
<th>Code</th><th>Jina</th><th>Simu</th><th>Mkoa</th><th>Aina</th><th>Kipaumbele</th><th>SLA</th><th>Paralegal</th><th>Hali</th><th>Badilisha</th><th>Angalia</th>
</tr></thead><tbody>${casesRows}</tbody></table>

<h2>👥 Paralegals</h2>
<table><thead><tr><th>Jina</th><th>Mkoa</th><th>Utaalamu</th><th>Kesi</th><th>Mzigo</th></tr></thead>
<tbody>${paralegalsRows}</tbody></table>

</body></html>`;
}

// ============================================================
// CASE DETAIL
// ============================================================
app.get('/dashboard/case/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const c = db.cases.find(x => x.id === id);
  if (!c) return res.status(404).send(forbiddenPage('Kesi haipatikani.'));
  if (!canAccessCase(req.user, c)) {
    audit(req.user, 'access_denied', c.caseCode, `Region: ${req.user.region}`);
    return res.status(403).send(forbiddenPage('Hauna ruhusa kuona kesi hii.'));
  }
  audit(req.user, 'view_case', c.caseCode);

  const p = db.paralegals.find(x => x.id === c.paralegalId);
  const slaStatus = getSLAStatus(c);
  const slaText = getSLARemainingText(c);
  const slaDeadline = getSLADeadline(c.createdAt, c.priority);

  const notesHtml = (c.notes || []).map(n => `<div class="note ${n.type}">
    <div class="note-icon">${n.type === 'created' ? '📝' : n.type === 'assigned' ? '👤' : n.type === 'status_change' ? '🔄' : n.type === 'resolution' ? '✅' : '💬'}</div>
    <div class="note-body"><div class="note-text">${n.text}</div>
    <div class="note-meta">${n.by} · ${new Date(n.at).toLocaleString('sw-TZ')}</div></div>
  </div>`).join('');

  const slaHistoryHtml = (c.slaHistory || []).map(h => `<div class="sla-event">
    <span class="sla-badge ${h.status}">${h.status}</span>
    <span>${h.event}</span>
    <span class="sla-time">${new Date(h.at).toLocaleString('sw-TZ')}</span>
  </div>`).join('');

  res.send(`<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Kesi ${c.caseCode}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:2rem;max-width:900px;margin:0 auto;}
a.back{color:#ff2d55;text-decoration:none;font-size:.9rem;font-weight:600;}
h1{font-size:1.8rem;margin:1rem 0 .5rem;}
.subtitle{color:#888;font-size:.9rem;margin-bottom:2rem;}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;}
.info-card{background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:1.2rem;}
.info-label{color:#888;font-size:.7rem;text-transform:uppercase;margin-bottom:.5rem;}
.info-value{font-size:1.1rem;font-weight:600;}
.badge{padding:.25rem .6rem;border-radius:100px;font-size:.7rem;font-weight:700;display:inline-block;}
.badge.imepokelewa{background:#332200;color:#ffaa00;}
.badge.inaendelea{background:#002244;color:#00aaff;}
.badge.inasubiri_mteja{background:#1a1a1a;color:#aaa;}
.badge.imemalizika{background:#003300;color:#00ff66;}
.badge.imekataliwa{background:#440011;color:#ff5577;}
.badge.high{background:#440011;color:#ff5577;}
.badge.medium{background:#332200;color:#ffaa00;}
.badge.low{background:#1a1a1a;color:#888;}
.sla{padding:.25rem .6rem;border-radius:6px;font-size:.75rem;font-weight:700;}
.sla.on_track{background:#002211;color:#00ff88;}
.sla.warning{background:#332200;color:#ffaa00;}
.sla.critical{background:#331a00;color:#ff7700;}
.sla.breached{background:#440011;color:#ff5577;}
.sla.resolved{background:#0a0a0a;color:#666;}
.desc{background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:1.5rem;margin-bottom:2rem;line-height:1.6;}
h2{font-size:1.1rem;margin:2rem 0 1rem;}
.timeline{position:relative;padding-left:2rem;}
.timeline::before{content:'';position:absolute;left:15px;top:0;bottom:0;width:2px;background:#1f1f1f;}
.note{display:flex;gap:1rem;margin-bottom:1.5rem;position:relative;}
.note-icon{width:32px;height:32px;border-radius:50%;background:#1a1a1a;border:2px solid #2a2a2a;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;flex-shrink:0;}
.note.created .note-icon{border-color:#ff2d55;}
.note.assigned .note-icon{border-color:#00aaff;}
.note.status_change .note-icon{border-color:#ffaa00;}
.note.resolution .note-icon{border-color:#00ff66;}
.note.note .note-icon{border-color:#666;}
.note-body{flex:1;padding-top:.2rem;}
.note-text{font-size:.95rem;margin-bottom:.2rem;}
.note-meta{color:#666;font-size:.75rem;}
.sla-event{display:flex;gap:1rem;padding:.5rem 0;font-size:.85rem;align-items:center;}
.sla-badge{padding:.15rem .5rem;border-radius:6px;font-size:.7rem;font-weight:700;}
.sla-time{color:#666;font-size:.75rem;margin-left:auto;}
.add-note{background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:1.5rem;margin-top:2rem;}
textarea{width:100%;background:#0a0a0a;border:1px solid #2a2a2a;color:#fff;padding:.8rem;border-radius:8px;font-family:inherit;font-size:.9rem;resize:vertical;min-height:80px;}
textarea:focus{outline:none;border-color:#ff2d55;}
button{background:#ff2d55;color:#fff;border:none;padding:.7rem 1.5rem;border-radius:8px;font-weight:700;cursor:pointer;margin-top:.5rem;}
button:hover{background:#e02048;}
</style></head><body>

<a href="/dashboard" class="back">← Rudi Dashboard</a>
<h1>Kesi ${c.caseCode}</h1>
<div class="subtitle">Imeundwa ${new Date(c.createdAt).toLocaleString('sw-TZ')} · SLA deadline: ${slaDeadline.toLocaleString('sw-TZ')}</div>

<div class="info">
  <div class="info-card"><div class="info-label">Jina</div><div class="info-value">${c.name}</div></div>
  <div class="info-card"><div class="info-label">Simu</div><div class="info-value">${c.phone}</div></div>
  <div class="info-card"><div class="info-label">Mkoa</div><div class="info-value">${c.region}</div></div>
  <div class="info-card"><div class="info-label">Aina</div><div class="info-value">${c.category}</div></div>
  <div class="info-card"><div class="info-label">Kipaumbele</div><div class="info-value"><span class="badge ${c.priority.toLowerCase()}">${c.priority}</span></div></div>
  <div class="info-card"><div class="info-label">Hali</div><div class="info-value"><span class="badge ${c.status}">${c.status}</span></div></div>
  <div class="info-card"><div class="info-label">SLA</div><div class="info-value"><span class="sla ${slaStatus}">${slaText}</span></div></div>
  <div class="info-card"><div class="info-label">Paralegal</div><div class="info-value">${p ? p.name : '—'}</div></div>
</div>

<div class="desc"><div class="info-label">Maelezo ya Mteja</div>${c.description}</div>

<h2>📝 Historia (${c.notes ? c.notes.length : 0})</h2>
<div class="timeline">${notesHtml}</div>

<h2>⏱️ SLA History</h2>
<div style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:1.2rem;">${slaHistoryHtml || '<p style="color:#666;">Hakuna events.</p>'}</div>

<div class="add-note">
  <h3 style="margin-bottom:1rem;font-size:.9rem;">➕ Ongeza Maendeleo</h3>
  <form method="POST" action="/dashboard/case/${c.id}/note">
    <select name="type" style="background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;padding:.5rem;border-radius:6px;margin-bottom:.8rem;">
      <option value="note">💬 Note</option>
      <option value="resolution">✅ Resolution</option>
    </select>
    <textarea name="text" placeholder="Andika maendeleo..." required></textarea>
    <button type="submit">Ongeza</button>
  </form>
</div>

</body></html>`);
});

app.post('/dashboard/case/:id/note', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const c = db.cases.find(x => x.id === id);
  if (!c) return res.status(404).send(forbiddenPage('Kesi haipatikani.'));
  if (!canAccessCase(req.user, c)) {
    audit(req.user, 'access_denied', c.caseCode, 'add_note');
    return res.status(403).send(forbiddenPage('Hauna ruhusa.'));
  }
  if (req.body.text) {
    if (!c.notes) c.notes = [];
    c.notes.push({
      type: req.body.type || 'note',
      text: req.body.text.substring(0, 500),
      by: req.user.name, at: new Date(),
    });
    c.updatedAt = new Date();
    audit(req.user, 'add_note', c.caseCode, req.body.text.substring(0, 100));
  }
  res.redirect(`/dashboard/case/${id}`);
});

app.post('/dashboard/update/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const c = db.cases.find(x => x.id === id);
  if (!c) return res.status(404).send(forbiddenPage('Kesi haipatikani.'));
  if (!canAccessCase(req.user, c)) {
    audit(req.user, 'access_denied', c.caseCode, 'update');
    return res.status(403).send(forbiddenPage('Hauna ruhusa.'));
  }
  const result = transitionCase(id, req.body.status, req.user);
  if (!result.ok) {
    return res.status(400).send(forbiddenPage(`Imeshindwa: ${result.error}`));
  }
  if (c.status === 'imemalizika') {
    queueSMS(c.phone, `Kesi yako ${c.caseCode} imemalizika. Asante.`, { priority: 'normal' });
  }
  res.redirect('/dashboard');
});

// ============================================================
// USERS
// ============================================================
app.get('/dashboard/users', requireAuth, requireRole('admin', 'supervisor'), (req, res) => {
  const users = scopeUsers(req.user);
  audit(req.user, 'view_users', 'users', `Count: ${users.length}`);
  const rows = users.map(u => `<tr>
    <td>${u.id}</td><td><strong>${u.username}</strong></td><td>${u.name}</td>
    <td><span class="role-badge ${u.role}">${u.role}</span></td>
    <td>${u.region || '—'}</td><td>${u.active ? '✅' : '❌'}</td>
  </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Watumiaji</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:2rem;}
a.back{color:#ff2d55;text-decoration:none;font-size:.9rem;font-weight:600;}
h1{font-size:1.6rem;margin:1rem 0;}
.banner{background:#002244;border:1px solid #003366;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.85rem;color:#66ccff;}
table{width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden;font-size:.85rem;}
th{background:#1a1a1a;color:#888;text-transform:uppercase;font-size:.7rem;padding:1rem;text-align:left;}
td{padding:1rem;border-bottom:1px solid #1a1a1a;}
.role-badge{padding:.25rem .6rem;border-radius:100px;font-size:.7rem;font-weight:700;}
.role-badge.admin{background:#440011;color:#ff5577;}
.role-badge.supervisor{background:#002244;color:#00aaff;}
.role-badge.paralegal{background:#002211;color:#00ff88;}</style></head><body>
<a href="/dashboard" class="back">← Rudi Dashboard</a>
<h1>👥 Watumiaji</h1>
<div class="banner">${req.user.role === 'supervisor' ? `🔒 Watumiaji wa <strong>${req.user.region}</strong> tu.` : '👑 Watumiaji wote.'}</div>
<table><thead><tr><th>ID</th><th>Username</th><th>Jina</th><th>Role</th><th>Mkoa</th><th>Active</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`);
});

// ============================================================
// AUDIT LOG
// ============================================================
app.get('/audit', requireAuth, requireRole('admin', 'supervisor'), (req, res) => {
  const logs = scopeAuditLog(req.user).slice().reverse().slice(0, 100);
  audit(req.user, 'view_audit', 'audit');
  const rows = logs.length === 0
    ? `<tr><td colspan="5" class="empty">Hakuna kumbukumbu.</td></tr>`
    : logs.map(l => `<tr>
        <td>${new Date(l.at).toLocaleString('sw-TZ')}</td>
        <td><strong>${l.username}</strong><br><span style="color:#666;font-size:.7rem;">${l.role}</span></td>
        <td>${l.action}</td><td>${l.target || '—'}</td><td>${l.details || '—'}</td>
      </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Audit</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:2rem;}
a.back{color:#ff2d55;text-decoration:none;font-size:.9rem;font-weight:600;}
h1{font-size:1.6rem;margin:1rem 0;}
table{width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden;font-size:.8rem;}
th{background:#1a1a1a;color:#888;text-transform:uppercase;font-size:.7rem;padding:.9rem;text-align:left;}
td{padding:.9rem;border-bottom:1px solid #1a1a1a;}
.empty{text-align:center;color:#666;padding:3rem;}</style></head><body>
<a href="/dashboard" class="back">← Rudi Dashboard</a>
<h1>📜 Audit Log (100)</h1>
<table><thead><tr><th>Wakati</th><th>Mtumiaji</th><th>Kitendo</th><th>Lengo</th><th>Maelezo</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`);
});

// ============================================================
// METRICS
// ============================================================
app.get('/api/metrics', requireAuth, requireRole('admin', 'supervisor'), (req, res) => {
  const cases = scopeCases(req.user);
  const paralegals = scopeParalegals(req.user);
  audit(req.user, 'view_metrics', 'metrics');

  const byCategory = {}, byRegion = {}, byStatus = {}, byPriority = {};
  cases.forEach(c => {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
  });

  const resolvedCases = cases.filter(c => c.status === 'imemalizika');
  const avgHours = resolvedCases.length
    ? resolvedCases.reduce((s, c) => s + (c.updatedAt - c.createdAt) / 3600000, 0) / resolvedCases.length
    : 0;

  const weekAgo = Date.now() - 7 * 24 * 3600000;
  const thisWeek = cases.filter(c => c.createdAt.getTime() > weekAgo).length;
  const lastWeek = cases.filter(c => {
    const t = c.createdAt.getTime();
    return t > weekAgo - 7 * 24 * 3600000 && t <= weekAgo;
  }).length;

  const slaBreached = resolvedCases.filter(c => c.slaHistory?.some(h => h.event === 'breached')).length;
  const compliance = resolvedCases.length
    ? (((resolvedCases.length - slaBreached) / resolvedCases.length) * 100).toFixed(1) + '%'
    : 'N/A';

  res.json({
    generatedAt: new Date().toISOString(),
    scope: {
      role: req.user.role, region: req.user.region || 'all',
      description: req.user.role === 'admin' ? 'Kitaifa' : `Mkoa: ${req.user.region}`,
    },
    totals: {
      cases: cases.length, paralegals: paralegals.length,
      activeParalegals: paralegals.filter(p => p.activeCases < p.maxCaseload).length,
    },
    trend: {
      thisWeek, lastWeek,
      change: lastWeek ? (((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) + '%' : 'N/A',
      direction: thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'flat',
    },
    sla: {
      compliance,
      breached: cases.filter(c => getSLAStatus(c) === 'breached').length,
      critical: cases.filter(c => getSLAStatus(c) === 'critical').length,
      warning: cases.filter(c => getSLAStatus(c) === 'warning').length,
      onTrack: cases.filter(c => getSLAStatus(c) === 'on_track').length,
      resolved: resolvedCases.length,
    },
    funnel: {
      started: db.stats.started, completed: db.stats.completed,
      completionRate: db.stats.started ? ((db.stats.completed / db.stats.started) * 100).toFixed(1) + '%' : '0%',
      usedSijui: db.stats.usedSijui, usedConfirmBack: db.stats.usedConfirmBack,
      duplicatesBlocked: db.stats.duplicatesBlocked,
    },
    byCategory, byRegion, byStatus, byPriority,
    languages: db.stats.byLanguage,
    performance: {
      avgResolutionHours: avgHours.toFixed(2),
      resolutionRate: cases.length ? ((resolvedCases.length / cases.length) * 100).toFixed(1) + '%' : '0%',
    },
  });
});

// ============================================================
// PERFORMANCE API
// ============================================================
app.get('/api/performance', requireAuth, requireRole('admin', 'supervisor'), (req, res) => {
  const cases = scopeCases(req.user);
  const paralegals = scopeParalegals(req.user);

  const regionPerf = {};
  Object.values(REGIONS).forEach(r => {
    const rc = cases.filter(c => c.region === r.name);
    const rr = rc.filter(c => c.status === 'imemalizika');
    regionPerf[r.name] = {
      total: rc.length, resolved: rr.length,
      rate: rc.length ? ((rr.length / rc.length) * 100).toFixed(1) + '%' : 'N/A',
      avgHours: rr.length ? (rr.reduce((s, c) => s + (c.updatedAt - c.createdAt) / 3600000, 0) / rr.length).toFixed(1) : 'N/A',
    };
  });

  const paralegalPerf = paralegals.map(p => {
    const pc = cases.filter(c => c.paralegalId === p.id);
    const pr = pc.filter(c => c.status === 'imemalizika');
    return {
      name: p.name, region: p.region,
      active: p.activeCases, max: p.maxCaseload,
      total: pc.length, resolved: pr.length,
      rate: pc.length ? ((pr.length / pc.length) * 100).toFixed(1) + '%' : 'N/A',
      avgHours: pr.length ? (pr.reduce((s, c) => s + (c.updatedAt - c.createdAt) / 3600000, 0) / pr.length).toFixed(1) : 'N/A',
    };
  });

  audit(req.user, 'view_performance', 'performance');
  res.json({ generatedAt: new Date().toISOString(), regionPerformance: regionPerf, paralegalPerformance: paralegalPerf });
});

// ============================================================
// SIMULATOR
// ============================================================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="sw"><head><meta charset="UTF-8"><title>Simulator</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;}
.wrap{max-width:540px;width:100%;}
h1{font-size:1.6rem;margin-bottom:.5rem;}h1 span{color:#ff2d55;}
.sub{color:#888;font-size:.85rem;margin-bottom:1.5rem;}
.phone{background:#111;border:2px solid #222;border-radius:24px;padding:1.5rem;}
.notch{width:60px;height:6px;background:#222;border-radius:100px;margin:0 auto 1rem;}
.screen{background:#000;color:#0f0;padding:1.2rem;border-radius:12px;font-family:'Courier New',monospace;min-height:260px;white-space:pre-wrap;margin-bottom:1rem;font-size:.85rem;line-height:1.5;border:1px solid #1a1a1a;}
input{flex:1;padding:.9rem;font-size:1rem;background:#1a1a1a;color:#fff;border:1px solid #2a2a2a;border-radius:10px;outline:none;width:100%;margin-bottom:.5rem;}
input:focus{border-color:#ff2d55;}
button{padding:.9rem 1.2rem;background:#ff2d55;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;}
button.ghost{background:#1a1a1a;border:1px solid #2a2a2a;}
.btns{display:flex;gap:.5rem;}
.btns button{flex:1;}
.links{margin-top:1rem;text-align:center;font-size:.85rem;}
.links a{color:#ff2d55;text-decoration:none;margin:0 .5rem;}
.steps{background:#111;border:1px solid #1f1f1f;border-radius:10px;padding:1rem;margin-top:1rem;font-size:.78rem;color:#888;line-height:1.6;}
.steps strong{color:#ff2d55;}
code{background:#1a1a1a;padding:.1rem .4rem;border-radius:4px;color:#ff6b8a;}</style></head><body>
<div class="wrap">
<h1>⚖️ Legal Aid <span>USSD</span> v5.0</h1>
<p class="sub">Simulator — production logic</p>
<div class="phone"><div class="notch"></div>
<div class="screen" id="screen">Bonyeza "Tuma" kuanza...</div>
<input id="input" placeholder='Weka chaguo (mfano: 1)' onkeypress="if(event.key==='Enter')send()" />
<div class="btns"><button onclick="send()">Tuma</button><button class="ghost" onclick="reset()">Anza Upya</button></div>
</div>
<div class="links"><a href="/login">→ Dashboard (Login)</a></div>
<div class="steps"><strong>Demo:</strong> <code>admin/admin123</code> · <code>super/super123</code> · <code>asha/asha123</code><br>
<strong>Mfuatano:</strong> <code>1</code> → <code>1</code> → <code>1</code> → <code>Asha</code> → <code>0712345678</code> → <code>2</code> → <code>Nina tatizo la ardhi na jirani</code></div>
</div>
<script>
let text='';const phone='+255712345678';
async function send(){const i=document.getElementById('input').value.trim();if(!i)return;text=text?text+'*'+i:i;document.getElementById('input').value='';await call();}
async function call(){try{const r=await fetch('/ussd',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({phoneNumber:phone,text,sessionId:'sim-'+Date.now()})});const d=await r.text();document.getElementById('screen').textContent=d.replace(/^(CON|END)\\s*/,'');}catch(e){document.getElementById('screen').textContent='Hitilafu: '+e.message;}}
function reset(){text='';document.getElementById('screen').textContent='Bonyeza "Tuma" kuanza...';}
</script></body></html>`);
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('  ⚖️  LEGAL AID USSD v5.0 PRODUCTION — Tanzania');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  📱 Simulator:  http://localhost:${PORT}`);
  console.log(`  🔐 Login:      http://localhost:${PORT}/login`);
  console.log(`  📊 Dashboard:  http://localhost:${PORT}/dashboard`);
  console.log('');
  console.log('  🏗️  PRODUCTION FEATURES:');
  console.log('     ✓ 5-tier deterministic assignment');
  console.log('     ✓ SLA (business hours + 5 levels)');
  console.log('     ✓ State machine transitions');
  console.log('     ✓ Duplicate detection (Jaccard)');
  console.log('     ✓ Atomic transactions');
  console.log('     ✓ Idempotent USSD');
  console.log('     ✓ Multi-layer validators');
  console.log('     ✓ SMS queue (retry + priority)');
  console.log('     ✓ Scoped metrics & performance');
  console.log('     ✓ Security headers');
  console.log('');
  console.log('  🔒 Data isolation: admin > supervisor > paralegal');
  console.log('  ⏱️  SLA: HIGH=2h · MEDIUM=1d · LOW=3d (business hours)');
  console.log('');
});