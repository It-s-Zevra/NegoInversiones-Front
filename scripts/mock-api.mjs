/**
 * Mock API server — SOLO para desarrollo/pruebas locales sin el backend real.
 * Implementa los endpoints de auth y el contador de notificaciones según "flujos".
 *
 *   node scripts/mock-api.mjs        (o  npm run mock:api)
 *
 * Credenciales demo:  admin@negoinversiones.com  /  Sup3rS3cret!
 */
import { createServer } from "node:http";

const PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : 3002;
const PREFIX = "/api/v1";

const DEMO = { email: "admin@negoinversiones.com", password: "Sup3rS3cret!" };
const ME = {
  id: "1",
  firstName: "Admin",
  lastName: "NegoInversiones",
  email: DEMO.email,
  phone: "+59170000000",
  role: "ADMIN",
  department: "Sistemas",
  isActive: true,
  lastLoginAt: new Date().toISOString(),
  img: null,
};

let seq = 0;
const tokens = () => {
  seq += 1;
  return {
    accessToken: `access-${seq}-${Date.now()}`,
    refreshToken: `refresh-${seq}-${Date.now()}`,
    tokenType: "Bearer",
    expiresIn: 900,
  };
};

const send = (res, status, body) => {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(payload);
};

const err = (res, statusCode, error, message) =>
  send(res, statusCode, {
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
  });

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });

const bearer = (req) => {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};

// ---------- Projects (store en memoria) ----------
const BRANDS = ["VISTA_VERDE", "GONZALES_CONSTRUCTORA", "ISABELLA_CONDOMINIO"];
const TYPES = ["LOTE", "VIVIENDA"];
const CITIES = [
  "Santa Cruz de la Sierra",
  "Cochabamba",
  "La Paz",
  "Tarija",
  "Sucre",
];
const PROJECT_SORT = ["name", "city", "totalUnits", "createdAt", "updatedAt"];
const BRAND_NAME = {
  VISTA_VERDE: "Vista Verde",
  GONZALES_CONSTRUCTORA: "Gonzales",
  ISABELLA_CONDOMINIO: "Isabella",
};

let projectSeq = 0;
const projects = [];
(function seedProjects() {
  const base = Date.UTC(2026, 0, 1);
  for (let i = 1; i <= 23; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const type = TYPES[i % TYPES.length];
    const created = new Date(base + i * 86400000).toISOString();
    projects.push({
      id: String(++projectSeq),
      name: `${BRAND_NAME[brand]} ${type === "LOTE" ? "Lotes" : "Residencial"} ${i}`,
      brand,
      type,
      location: `Av. Principal km ${i}`,
      city: CITIES[i % CITIES.length],
      description: "Proyecto de demostración para QA del panel.",
      totalUnits: 20 + i * 5,
      metadata: null,
      imgUrl: null,
      isActive: i % 5 !== 0,
      createdAt: created,
      updatedAt: created,
    });
  }
})();

const matchesProject = (p, q) => {
  if (q.search) {
    const s = q.search.toLowerCase();
    if (!`${p.name} ${p.city ?? ""}`.toLowerCase().includes(s)) return false;
  }
  if (q.brand && p.brand !== q.brand) return false;
  if (q.type && p.type !== q.type) return false;
  if (q.city && !(p.city ?? "").toLowerCase().includes(q.city.toLowerCase()))
    return false;
  if (q.isActive === "true" && !p.isActive) return false;
  if (q.isActive === "false" && p.isActive) return false;
  return true;
};

const validateProject = (body, isCreate) => {
  const m = [];
  if (isCreate) {
    if (!body.name || !String(body.name).trim())
      m.push("name should not be empty");
    if (!BRANDS.includes(body.brand))
      m.push(`brand must be one of the following values: ${BRANDS.join(", ")}`);
    if (!TYPES.includes(body.type))
      m.push(`type must be one of the following values: ${TYPES.join(", ")}`);
  } else {
    if (body.brand !== undefined && !BRANDS.includes(body.brand))
      m.push(`brand must be one of the following values: ${BRANDS.join(", ")}`);
    if (body.type !== undefined && !TYPES.includes(body.type))
      m.push(`type must be one of the following values: ${TYPES.join(", ")}`);
  }
  if (
    body.totalUnits !== undefined &&
    body.totalUnits !== null &&
    (typeof body.totalUnits !== "number" || body.totalUnits < 0)
  )
    m.push("totalUnits must not be less than 0");
  return m;
};

const PROJECT_FIELDS = [
  "name",
  "brand",
  "type",
  "location",
  "city",
  "description",
  "totalUnits",
  "metadata",
  "imgUrl",
  "isActive",
];
const pickProject = (body) => {
  const out = {};
  for (const k of PROJECT_FIELDS) if (body[k] !== undefined) out[k] = body[k];
  return out;
};

// ---------- Units (store en memoria) ----------
const UNIT_STATUSES = ["DISPONIBLE", "RESERVADO", "VENDIDO", "BLOQUEADO"];
const UNIT_SORT = ["code", "price", "areaM2", "status", "createdAt"];
const FINANCING_PLANS = new Set(["1", "2", "3"]);
const UNIT_NUMERIC = ["areaM2", "price", "builtAreaM2", "frontageM", "depthM"];
const UNIT_INT = ["bedrooms", "bathrooms"];
const UNIT_PASS = [
  "code",
  "type",
  "status",
  "currency",
  "hasUtilities",
  "location",
  "address1",
  "address2",
  "references",
  "financingPlanId",
  "imgUrl",
];

let unitSeq = 0;
const units = [];
(function seedUnits() {
  const base = Date.UTC(2026, 0, 5);
  for (const p of projects) {
    const count = 4 + (Number(p.id) % 4); // 4..7 unidades por proyecto
    for (let i = 1; i <= count; i++) {
      const isViv = p.type === "VIVIENDA";
      const status = UNIT_STATUSES[i % UNIT_STATUSES.length];
      const created = new Date(base + Number(p.id) * 3600000 + i * 60000).toISOString();
      units.push({
        id: String(++unitSeq),
        projectId: p.id,
        code: `${isViv ? "V" : "L"}-${String(i).padStart(2, "0")}`,
        type: p.type,
        status,
        areaM2: (200 + i * 20).toFixed(2),
        price: (15000 + i * 5000).toFixed(2),
        currency: "USD",
        bedrooms: isViv ? 2 + (i % 3) : null,
        bathrooms: isViv ? 1 + (i % 2) : null,
        builtAreaM2: isViv ? (90 + i * 10).toFixed(2) : null,
        frontageM: isViv ? null : (10 + i).toFixed(2),
        depthM: isViv ? null : (25 + i).toFixed(2),
        hasUtilities: i % 2 === 0,
        imgUrl: null,
        location: `Sector ${i}`,
        address1: null,
        address2: null,
        references: null,
        financingPlanId: null,
        createdAt: created,
        updatedAt: created,
      });
    }
  }
})();

const matchesUnit = (u, q) => {
  if (q.status && u.status !== q.status) return false;
  if (q.type && u.type !== q.type) return false;
  return true;
};

const validateUnit = (body, isCreate) => {
  const m = [];
  if (isCreate) {
    if (!body.code || !String(body.code).trim())
      m.push("code should not be empty");
    if (!["LOTE", "VIVIENDA"].includes(body.type))
      m.push("type must be one of the following values: LOTE, VIVIENDA");
  } else {
    if (body.type !== undefined && !["LOTE", "VIVIENDA"].includes(body.type))
      m.push("type must be one of the following values: LOTE, VIVIENDA");
  }
  if (body.status !== undefined && !UNIT_STATUSES.includes(body.status))
    m.push(
      `status must be one of the following values: ${UNIT_STATUSES.join(", ")}`
    );
  for (const k of UNIT_NUMERIC) {
    if (body[k] !== undefined && body[k] !== null) {
      if (typeof body[k] !== "number" || body[k] < 0)
        m.push(`${k} must not be less than 0`);
    }
  }
  for (const k of UNIT_INT) {
    if (body[k] !== undefined && body[k] !== null) {
      if (!Number.isInteger(body[k]) || body[k] < 0)
        m.push(`${k} must be an integer number not less than 0`);
    }
  }
  if (
    body.currency !== undefined &&
    String(body.currency).length !== 3
  )
    m.push("currency must be longer than or equal to 3 characters");
  return m;
};

const applyUnitBody = (target, body) => {
  for (const k of UNIT_PASS) if (body[k] !== undefined) target[k] = body[k];
  for (const k of UNIT_NUMERIC)
    if (body[k] !== undefined)
      target[k] = body[k] === null ? null : Number(body[k]).toFixed(2);
  for (const k of UNIT_INT)
    if (body[k] !== undefined) target[k] = body[k];
};

// ---------- Sales (store en memoria) ----------
const SALE_STATUSES = ["EN_PROCESO", "COMPLETADA", "CANCELADA"];
const SALE_SORT = ["createdAt", "contractDate", "totalPrice", "status"];
const LEADS = new Set(Array.from({ length: 31 }, (_, i) => String(100 + i))); // 100..130
const EXECUTIVES = new Set(["1", "2", "3", "4", "5", "6"]);
const SALE_MONEY = ["totalPrice", "downPayment", "interestRate"];
const SALE_PASS = [
  "leadId",
  "unitId",
  "projectId",
  "executiveId",
  "status",
  "currency",
  "contractDate",
  "agreements",
];

let saleSeq = 0;
const sales = [];
(function seedSales() {
  const base = Date.UTC(2026, 0, 10);
  for (let i = 1; i <= 30; i++) {
    const project = projects[i % projects.length];
    const created = new Date(base + i * 86400000).toISOString();
    const contractDate = new Date(base + i * 86400000).toISOString().slice(0, 10);
    sales.push({
      id: String(++saleSeq),
      leadId: String(100 + (i % 31)),
      unitId: units.find((u) => u.projectId === project.id)?.id ?? null,
      projectId: project.id,
      executiveId: String(1 + (i % 6)),
      status: SALE_STATUSES[i % SALE_STATUSES.length],
      totalPrice: (20000 + i * 1500).toFixed(2),
      currency: "USD",
      downPayment: i % 3 === 0 ? (5000).toFixed(2) : null,
      contractDate,
      financingTermMonths: i % 2 === 0 ? 60 : null,
      interestRate: i % 2 === 0 ? (12.5).toFixed(2) : null,
      agreements: null,
      createdAt: created,
      updatedAt: created,
    });
  }
})();

const matchesSale = (s, q) => {
  if (q.status && s.status !== q.status) return false;
  if (q.projectId && s.projectId !== q.projectId) return false;
  if (q.leadId && s.leadId !== q.leadId) return false;
  if (q.executiveId && s.executiveId !== q.executiveId) return false;
  if (q.contractDateFrom && (!s.contractDate || s.contractDate < q.contractDateFrom))
    return false;
  if (q.contractDateTo && (!s.contractDate || s.contractDate > q.contractDateTo))
    return false;
  return true;
};

const validateSale = (body, isCreate) => {
  const m = [];
  if (isCreate) {
    if (!body.leadId || !String(body.leadId).trim())
      m.push("leadId should not be empty");
    if (!body.projectId || !String(body.projectId).trim())
      m.push("projectId should not be empty");
    if (body.totalPrice === undefined || body.totalPrice === null)
      m.push("totalPrice should not be empty");
  }
  if (
    body.totalPrice !== undefined &&
    body.totalPrice !== null &&
    (typeof body.totalPrice !== "number" || body.totalPrice < 0)
  )
    m.push("totalPrice must not be less than 0");
  for (const k of ["downPayment", "interestRate"]) {
    if (
      body[k] !== undefined &&
      body[k] !== null &&
      (typeof body[k] !== "number" || body[k] < 0)
    )
      m.push(`${k} must not be less than 0`);
  }
  if (
    body.financingTermMonths !== undefined &&
    body.financingTermMonths !== null &&
    (!Number.isInteger(body.financingTermMonths) || body.financingTermMonths < 0)
  )
    m.push("financingTermMonths must be an integer number not less than 0");
  if (body.currency !== undefined && String(body.currency).length !== 3)
    m.push("currency must be longer than or equal to 3 characters");
  if (body.status !== undefined && !SALE_STATUSES.includes(body.status))
    m.push(
      `status must be one of the following values: ${SALE_STATUSES.join(", ")}`
    );
  if (
    body.contractDate !== undefined &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(body.contractDate))
  )
    m.push("contractDate must be a valid ISO 8601 date string");
  return m;
};

/** Valida FKs en orden lead → proyecto → unidad → ejecutivo. Devuelve mensaje o null. */
const validateSaleFks = (body, isCreate) => {
  if (isCreate) {
    if (!LEADS.has(String(body.leadId)))
      return `El lead "${body.leadId}" no existe.`;
    if (!projects.some((p) => p.id === String(body.projectId)))
      return `El proyecto "${body.projectId}" no existe.`;
  }
  if (
    body.unitId !== undefined &&
    body.unitId !== null &&
    body.unitId !== "" &&
    !units.some((u) => u.id === String(body.unitId))
  )
    return `La unidad "${body.unitId}" no existe.`;
  if (
    body.executiveId !== undefined &&
    body.executiveId !== null &&
    body.executiveId !== "" &&
    !EXECUTIVES.has(String(body.executiveId))
  )
    return `El ejecutivo "${body.executiveId}" no existe.`;
  return null;
};

const applySaleBody = (target, body) => {
  for (const k of SALE_PASS) if (body[k] !== undefined) target[k] = body[k];
  for (const k of SALE_MONEY)
    if (body[k] !== undefined)
      target[k] = body[k] === null ? null : Number(body[k]).toFixed(2);
  if (body.financingTermMonths !== undefined)
    target.financingTermMonths = body.financingTermMonths;
};

// ---------- Financing plans (store en memoria) ----------
const FP_TYPES = ["CONTADO", "CREDITO_DIRECTO", "CREDITO_BANCARIO", "MIXTO"];
const DP_TYPES = ["NONE", "FIXED", "PERCENT"];
const FREQS = ["MENSUAL", "QUINCENAL", "SEMANAL", "DIARIO", "ANUAL"];
const FP_SORT = ["name", "type", "createdAt", "updatedAt"];
const FP_MONEY = [
  "downPaymentRequired",
  "downPaymentPercent",
  "installmentAmount",
  "interestRate",
  "cashDiscountPercent",
  "minAmount",
];
const FP_INT = ["installmentsCount", "termMonths"];
const FP_PASS = [
  "name",
  "description",
  "type",
  "currency",
  "downPaymentType",
  "frequency",
  "isActive",
];
const FP_TYPE_NAME = {
  CONTADO: "Contado",
  CREDITO_DIRECTO: "Crédito directo",
  CREDITO_BANCARIO: "Crédito bancario",
  MIXTO: "Mixto",
};

let fpSeq = 0;
const financingPlans = [];
(function seedFinancingPlans() {
  const base = Date.UTC(2026, 0, 3);
  for (let i = 1; i <= 12; i++) {
    const type = FP_TYPES[i % FP_TYPES.length];
    const dp = DP_TYPES[i % DP_TYPES.length];
    const isContado = type === "CONTADO";
    const created = new Date(base + i * 86400000).toISOString();
    financingPlans.push({
      id: String(++fpSeq),
      name: `${FP_TYPE_NAME[type]} ${i}`,
      description: "Plan de demostración para QA.",
      type,
      currency: "USD",
      downPaymentType: dp,
      downPaymentRequired: dp === "FIXED" ? "200.00" : null,
      downPaymentPercent: dp === "PERCENT" ? "10.00" : null,
      installmentsCount: isContado ? null : 12 * ((i % 6) + 1),
      installmentAmount: isContado ? null : "515.00",
      frequency: "MENSUAL",
      termMonths: isContado ? null : 12 * ((i % 6) + 1),
      interestRate: isContado ? null : i % 2 ? "6.50" : "0.00",
      cashDiscountPercent: isContado ? "50.00" : null,
      minAmount: "1.00",
      isActive: i % 4 !== 0,
      createdAt: created,
      updatedAt: created,
    });
  }
})();

const matchesPlan = (p, q) => {
  if (q.search) {
    const s = q.search.toLowerCase();
    if (!`${p.name} ${p.description ?? ""}`.toLowerCase().includes(s))
      return false;
  }
  if (q.type && p.type !== q.type) return false;
  if (q.isActive === "true" && !p.isActive) return false;
  if (q.isActive === "false" && p.isActive) return false;
  return true;
};

const validatePlan = (body, isCreate) => {
  const m = [];
  if (isCreate) {
    if (!body.name || !String(body.name).trim())
      m.push("name should not be empty");
    if (!FP_TYPES.includes(body.type))
      m.push(`type must be one of the following values: ${FP_TYPES.join(", ")}`);
    if (!DP_TYPES.includes(body.downPaymentType))
      m.push(
        `downPaymentType must be one of the following values: ${DP_TYPES.join(", ")}`
      );
  } else {
    if (body.type !== undefined && !FP_TYPES.includes(body.type))
      m.push(`type must be one of the following values: ${FP_TYPES.join(", ")}`);
    if (
      body.downPaymentType !== undefined &&
      !DP_TYPES.includes(body.downPaymentType)
    )
      m.push(
        `downPaymentType must be one of the following values: ${DP_TYPES.join(", ")}`
      );
  }
  if (body.frequency !== undefined && !FREQS.includes(body.frequency))
    m.push(`frequency must be one of the following values: ${FREQS.join(", ")}`);
  if (body.currency !== undefined && String(body.currency).length !== 3)
    m.push("currency must be longer than or equal to 3 characters");
  for (const k of [
    "downPaymentRequired",
    "installmentAmount",
    "interestRate",
    "minAmount",
  ]) {
    if (body[k] !== undefined && body[k] !== null && (typeof body[k] !== "number" || body[k] < 0))
      m.push(`${k} must not be less than 0`);
  }
  for (const k of ["downPaymentPercent", "cashDiscountPercent"]) {
    if (body[k] !== undefined && body[k] !== null) {
      if (typeof body[k] !== "number" || body[k] < 0)
        m.push(`${k} must not be less than 0`);
      else if (body[k] > 100) m.push(`${k} must not be greater than 100`);
    }
  }
  for (const k of FP_INT) {
    if (body[k] !== undefined && body[k] !== null && (!Number.isInteger(body[k]) || body[k] < 0))
      m.push(`${k} must be an integer number not less than 0`);
  }
  return m;
};

const applyPlanBody = (target, body) => {
  for (const k of FP_PASS) if (body[k] !== undefined) target[k] = body[k];
  for (const k of FP_MONEY)
    if (body[k] !== undefined)
      target[k] = body[k] === null ? null : Number(body[k]).toFixed(2);
  for (const k of FP_INT) if (body[k] !== undefined) target[k] = body[k];
};

// ---------- RBAC: permissions, roles, users (en memoria) ----------
const nowIso = () => new Date().toISOString();
const PERMISSION_CODES = [
  "users:read", "users:write", "users:delete",
  "roles:read", "roles:write", "roles:delete",
  "permissions:read", "permissions:write", "permissions:delete",
  "projects:read", "projects:write", "projects:delete",
  "sales:read", "sales:write",
  "schedules:read", "schedules:write", "schedules:delete",
  "financing-plans:read", "financing-plans:write", "financing-plans:delete", "financing-options:write",
  "kb:read", "kb:write", "kb:delete",
  "api-clients:read", "api-clients:write", "api-clients:delete",
  "api-scopes:read", "api-scopes:write", "activity-log:read",
];
let permSeq = 0;
const permissions = PERMISSION_CODES.map((code) => ({
  id: String(++permSeq),
  code,
  name: code,
  description: null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));
const permByCode = (c) => permissions.find((p) => p.code === c);

const ROLE_DEFS = [
  ["ADMIN", "Administrador del Sistema"],
  ["DIRECTOR_GENERAL", "Director General"],
  ["JEFE_COMERCIAL", "Jefe Comercial"],
  ["EJECUTIVO_VENTAS", "Ejecutivo de Ventas"],
  ["CARTERA", "Cartera / Cobranzas"],
  ["LEGAL", "Legal"],
  ["FINANZAS", "Finanzas"],
  ["PROYECTOS", "Proyectos"],
];
let roleSeq = 0;
const roles = ROLE_DEFS.map(([code, name]) => ({
  id: String(++roleSeq),
  code,
  name,
  description: `Rol ${name}`,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));
// rolePerms: roleId -> Set(permissionId)
const rolePerms = new Map();
for (const r of roles) {
  if (r.code === "ADMIN") rolePerms.set(r.id, new Set(permissions.map((p) => p.id)));
  else rolePerms.set(r.id, new Set(["10", "13"])); // projects:read, sales:read (demo)
}
const roleByCode = (c) => roles.find((r) => r.code === c);

let userSeq = 0;
const users = [];
(function seedUsers() {
  const samples = [
    ["Admin", "NegoInversiones", "ADMIN", "Sistemas"],
    ["María", "Gonzales", "EJECUTIVO_VENTAS", "Comercial"],
    ["Carlos", "Rojas", "EJECUTIVO_VENTAS", "Comercial"],
    ["Lucía", "Méndez", "JEFE_COMERCIAL", "Comercial"],
    ["Diego", "Suárez", "FINANZAS", "Finanzas"],
    ["Ana", "Vaca", "CARTERA", "Cobranzas"],
    ["Jorge", "Áñez", "PROYECTOS", "Obras"],
    ["Sofía", "Justiniano", "LEGAL", "Legal"],
    ["Pedro", "Áñez", "DIRECTOR_GENERAL", "Dirección"],
    ["Elena", "Roca", "EJECUTIVO_VENTAS", "Comercial"],
  ];
  const base = Date.UTC(2026, 0, 1);
  samples.forEach((s, i) => {
    const [firstName, lastName, code, department] = s;
    const id = String(++userSeq);
    users.push({
      id,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@negoinversiones.com`,
      phone: "+59170000000",
      roleId: roleByCode(code).id,
      department,
      isActive: i % 7 !== 6,
      lastLoginAt: i === 0 ? nowIso() : null,
      img: null,
      createdAt: new Date(base + i * 86400000).toISOString(),
      updatedAt: new Date(base + i * 86400000).toISOString(),
    });
  });
})();
const USER_SORT = ["firstName", "lastName", "email", "createdAt"];

// ---------- API clients / scopes ----------
let scopeSeq = 0;
const apiScopes = ["leads:read", "leads:write", "kb:read", "projects:read", "log:write"].map(
  (code) => ({ id: String(++scopeSeq), code, description: null, createdAt: nowIso(), updatedAt: nowIso() })
);
let apiClientSeq = 0;
const apiClients = [];
const apiClientScopes = new Map(); // id -> Set(scopeId)
(function seedClients() {
  ["Integración n8n", "Agente WhatsApp"].forEach((name, i) => {
    const id = String(++apiClientSeq);
    apiClients.push({
      id, name, keyPrefix: `nk_${1000 + i}`, isActive: true,
      lastUsedAt: i === 0 ? nowIso() : null, createdAt: nowIso(), updatedAt: nowIso(),
    });
    apiClientScopes.set(id, new Set([apiScopes[0].id]));
  });
})();
const clientWithScopes = (c) => ({
  ...c,
  scopes: apiScopes.filter((s) => apiClientScopes.get(c.id)?.has(s.id)),
});

// ---------- KB ----------
let kbCatSeq = 0;
const kbCategories = ["FINANCIAMIENTO", "PROYECTOS", "LEGAL", "GENERAL"].map((code) => ({
  id: String(++kbCatSeq), code, name: code.charAt(0) + code.slice(1).toLowerCase(),
  createdAt: nowIso(), updatedAt: nowIso(),
}));
let kbTagSeq = 0;
const kbTags = ["credito", "contado", "entrega", "garantia", "promocion"].map((name) => ({
  id: String(++kbTagSeq), name, createdAt: nowIso(), updatedAt: nowIso(),
}));
let kbSeq = 0;
const kbEntries = [];
(function seedKb() {
  const base = Date.UTC(2026, 0, 2);
  for (let i = 1; i <= 15; i++) {
    const cat = kbCategories[i % kbCategories.length];
    kbEntries.push({
      id: String(++kbSeq),
      title: `Entrada de conocimiento ${i}`,
      content: "Contenido de demostración para QA del panel de conocimiento.",
      categoryId: cat.id,
      category: { id: cat.id, code: cat.code, name: cat.name },
      projectId: null,
      brand: i % 2 ? "VISTA_VERDE" : null,
      isActive: i % 6 !== 0,
      priority: (i * 7) % 10,
      source: "MANUAL",
      mediaUrls: null,
      tags: i % 3 === 0 ? [{ id: kbTags[0].id, name: kbTags[0].name }] : [],
      createdByUserId: "1",
      updatedByUserId: null,
      createdAt: new Date(base + i * 3600000).toISOString(),
      updatedAt: new Date(base + i * 3600000).toISOString(),
    });
  }
})();
const KB_SORT = ["priority", "title", "createdAt", "updatedAt"];

// ---------- Notifications ----------
let notifSeq = 0;
const notifications = [];
(function seedNotifs() {
  const types = ["LEAD_NEW", "GENERIC", "AVAILABILITY_EXCEPTION_PENDING", "AVAILABILITY_EXCEPTION_APPROVED"];
  for (let i = 1; i <= 8; i++) {
    notifications.push({
      id: String(++notifSeq),
      userId: "1",
      type: types[i % types.length],
      title: i % 4 === 0 ? "Nuevo lead desde WhatsApp" : `Notificación ${i}`,
      description: "Detalle de la notificación de demostración.",
      entityType: null, entityId: null, metadata: null,
      priority: i % 3 === 0 ? "HIGH" : "NORMAL",
      isRead: i > 5,
      readAt: i > 5 ? nowIso() : null,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    });
  }
})();

// ---------- Activity log ----------
let logSeq = 0;
const activityLog = [];
(function seedLog() {
  const actions = ["user.create", "project.update", "sale.create", "role.set_permissions", "financing_plan.activate"];
  const entities = ["user", "project", "sale", "role", "financing_plan"];
  for (let i = 1; i <= 30; i++) {
    activityLog.push({
      id: String(++logSeq),
      actorType: i % 5 === 0 ? "AGENT" : "FRONTEND",
      action: actions[i % actions.length],
      actorUserId: i % 5 === 0 ? null : "1",
      apiClientId: i % 5 === 0 ? "1" : null,
      entityType: entities[i % entities.length],
      entityId: String((i % 10) + 1),
      before: i % 2 ? { status: "EN_PROCESO" } : null,
      after: { id: String((i % 10) + 1), changed: true },
      ipAddress: "186.179.0.1",
      userAgent: "Mozilla/5.0",
      createdAt: new Date(Date.now() - i * 1800000).toISOString(),
    });
  }
})();

// ---------- Schedules / availability ----------
const userSchedules = new Map(); // userId -> [{id,userId,dayOfWeek,startTime,endTime,isActive,...}]
let schedSeq = 0;
(function seedSchedules() {
  for (const u of users.filter((x) => roles.find((r) => r.id === x.roleId)?.code === "EJECUTIVO_VENTAS")) {
    const wins = [1, 2, 3, 4, 5].map((d) => ({
      id: String(++schedSeq), userId: u.id, dayOfWeek: d,
      startTime: "09:00:00", endTime: "18:00:00", isActive: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    }));
    userSchedules.set(u.id, wins);
  }
})();
let excSeq = 0;
const exceptions = []; // availability exceptions
const AUTO_APPROVE = new Set(["BUSY", "NO_MOLESTAR", "EMERGENCIA"]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") return send(res, 204);
  if (path === "/health") return send(res, 200, { status: "ok" });

  const route = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;

  // POST /auth/login
  if (route === "/auth/login" && method === "POST") {
    const body = await readBody(req);
    const messages = [];
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      messages.push("email must be an email");
    if (!body.password || String(body.password).length < 8)
      messages.push("password must be longer than or equal to 8 characters");
    if (messages.length) return err(res, 400, "Bad Request", messages);
    if (body.email !== DEMO.email || body.password !== DEMO.password)
      return err(res, 401, "Unauthorized", "Invalid credentials");
    return send(res, 200, tokens());
  }

  // POST /auth/refresh
  if (route === "/auth/refresh" && method === "POST") {
    const body = await readBody(req);
    if (!body.refreshToken || !String(body.refreshToken).startsWith("refresh-"))
      return err(res, 401, "Unauthorized", "Invalid or expired refresh token");
    return send(res, 200, tokens());
  }

  // POST /auth/logout
  if (route === "/auth/logout" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, { message: "Session closed successfully." });
  }

  // GET /auth/me
  if (route === "/auth/me" && method === "GET") {
    const t = bearer(req);
    if (!t || !t.startsWith("access-"))
      return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, ME);
  }

  // GET /notifications/unread-count
  if (route === "/notifications/unread-count" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, { count: notifications.filter((n) => !n.isRead).length });
  }

  // ---------- Projects ----------
  if (route === "/projects" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    const sortBy = q.sortBy ?? "createdAt";
    if (!PROJECT_SORT.includes(sortBy))
      return err(res, 400, "Bad Request", [
        `sortBy must be one of the following values: ${PROJECT_SORT.join(", ")}`,
      ]);
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    const rows = projects
      .filter((p) => matchesProject(p, q))
      .sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number")
          return (av - bv) * order;
        return String(av).localeCompare(String(bv)) * order;
      });
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = rows.slice((page - 1) * limit, page * limit);
    return send(res, 200, { data, meta: { total, page, limit, totalPages } });
  }

  if (route === "/projects" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const msgs = validateProject(body, true);
    if (msgs.length) return err(res, 400, "Bad Request", msgs);
    const now = new Date().toISOString();
    const created = {
      id: String(++projectSeq),
      name: body.name,
      brand: body.brand,
      type: body.type,
      location: body.location ?? null,
      city: body.city ?? null,
      description: body.description ?? null,
      totalUnits: body.totalUnits ?? null,
      metadata: body.metadata ?? null,
      imgUrl: body.imgUrl ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    projects.unshift(created);
    return send(res, 201, created);
  }

  const projectIdMatch = route.match(/^\/projects\/([^/]+)$/);
  if (projectIdMatch) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const pid = projectIdMatch[1];
    const idx = projects.findIndex((p) => p.id === pid);

    if (method === "GET") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Proyecto no encontrado");
      return send(res, 200, projects[idx]);
    }
    if (method === "PATCH") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Proyecto no encontrado");
      const body = await readBody(req);
      const msgs = validateProject(body, false);
      if (msgs.length) return err(res, 400, "Bad Request", msgs);
      projects[idx] = {
        ...projects[idx],
        ...pickProject(body),
        updatedAt: new Date().toISOString(),
      };
      return send(res, 200, projects[idx]);
    }
    if (method === "DELETE") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Proyecto no encontrado");
      projects.splice(idx, 1);
      return send(res, 200, {
        message: "Proyecto eliminado correctamente.",
      });
    }
  }

  // ---------- Project units (list + create) ----------
  const projUnitsMatch = route.match(/^\/projects\/([^/]+)\/units$/);
  if (projUnitsMatch) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const pid = projUnitsMatch[1];
    const project = projects.find((p) => p.id === pid);
    if (!project) return err(res, 404, "Not Found", "Proyecto no encontrado");

    if (method === "GET") {
      const q = Object.fromEntries(url.searchParams);
      const sortBy = q.sortBy ?? "code";
      if (!UNIT_SORT.includes(sortBy))
        return err(res, 400, "Bad Request", [
          `sortBy must be one of the following values: ${UNIT_SORT.join(", ")}`,
        ]);
      const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
      const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
      const rows = units
        .filter((u) => u.projectId === pid && matchesUnit(u, q))
        .sort((a, b) => {
          let av = a[sortBy];
          let bv = b[sortBy];
          if (sortBy === "price" || sortBy === "areaM2") {
            av = av == null ? null : parseFloat(av);
            bv = bv == null ? null : parseFloat(bv);
          }
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number")
            return (av - bv) * order;
          return String(av).localeCompare(String(bv)) * order;
        });
      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const data = rows.slice((page - 1) * limit, page * limit);
      return send(res, 200, { data, meta: { total, page, limit, totalPages } });
    }

    if (method === "POST") {
      const body = await readBody(req);
      const msgs = validateUnit(body, true);
      if (msgs.length) return err(res, 400, "Bad Request", msgs);
      if (units.some((u) => u.projectId === pid && u.code === body.code))
        return err(
          res,
          409,
          "Conflict",
          `El proyecto ya tiene una unidad con el código "${body.code}".`
        );
      if (
        body.financingPlanId &&
        !FINANCING_PLANS.has(String(body.financingPlanId))
      )
        return err(
          res,
          422,
          "Unprocessable Entity",
          "El plan de financiamiento indicado no existe."
        );
      const now = new Date().toISOString();
      const unit = {
        id: String(++unitSeq),
        projectId: pid,
        code: body.code,
        type: body.type,
        status: body.status ?? "DISPONIBLE",
        areaM2: null,
        price: null,
        currency: "USD",
        bedrooms: null,
        bathrooms: null,
        builtAreaM2: null,
        frontageM: null,
        depthM: null,
        hasUtilities: null,
        imgUrl: null,
        location: null,
        address1: null,
        address2: null,
        references: null,
        financingPlanId: null,
        createdAt: now,
        updatedAt: now,
      };
      applyUnitBody(unit, body);
      units.unshift(unit);
      return send(res, 201, unit);
    }
  }

  // ---------- Unit state transitions ----------
  const unitActionMatch = route.match(
    /^\/units\/([^/]+)\/(reserve|sell|block|release)$/
  );
  if (unitActionMatch && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = units.findIndex((u) => u.id === unitActionMatch[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Unidad no encontrada");
    const statusByAction = {
      reserve: "RESERVADO",
      sell: "VENDIDO",
      block: "BLOQUEADO",
      release: "DISPONIBLE",
    };
    units[idx] = {
      ...units[idx],
      status: statusByAction[unitActionMatch[2]],
      updatedAt: new Date().toISOString(),
    };
    return send(res, 200, units[idx]);
  }

  // ---------- Unit by id (detail / edit / delete) ----------
  const unitIdMatch = route.match(/^\/units\/([^/]+)$/);
  if (unitIdMatch) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = units.findIndex((u) => u.id === unitIdMatch[1]);

    if (method === "GET") {
      if (idx === -1) return err(res, 404, "Not Found", "Unidad no encontrada");
      return send(res, 200, units[idx]);
    }
    if (method === "PATCH") {
      if (idx === -1) return err(res, 404, "Not Found", "Unidad no encontrada");
      const body = await readBody(req);
      const msgs = validateUnit(body, false);
      if (msgs.length) return err(res, 400, "Bad Request", msgs);
      if (
        body.code !== undefined &&
        units.some(
          (u) =>
            u.projectId === units[idx].projectId &&
            u.code === body.code &&
            u.id !== units[idx].id
        )
      )
        return err(
          res,
          409,
          "Conflict",
          `El proyecto ya tiene una unidad con el código "${body.code}".`
        );
      if (
        body.financingPlanId &&
        !FINANCING_PLANS.has(String(body.financingPlanId))
      )
        return err(
          res,
          422,
          "Unprocessable Entity",
          "El plan de financiamiento indicado no existe."
        );
      applyUnitBody(units[idx], body);
      units[idx].updatedAt = new Date().toISOString();
      return send(res, 200, units[idx]);
    }
    if (method === "DELETE") {
      if (idx === -1) return err(res, 404, "Not Found", "Unidad no encontrada");
      units.splice(idx, 1);
      return send(res, 200, { message: "Unidad eliminada correctamente." });
    }
  }

  // ---------- Sales ----------
  if (route === "/sales" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    const sortBy = q.sortBy ?? "createdAt";
    if (!SALE_SORT.includes(sortBy))
      return err(res, 400, "Bad Request", [
        `sortBy must be one of the following values: ${SALE_SORT.join(", ")}`,
      ]);
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    const rows = sales
      .filter((s) => matchesSale(s, q))
      .sort((a, b) => {
        let av = a[sortBy];
        let bv = b[sortBy];
        if (sortBy === "totalPrice") {
          av = av == null ? null : parseFloat(av);
          bv = bv == null ? null : parseFloat(bv);
        }
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number")
          return (av - bv) * order;
        return String(av).localeCompare(String(bv)) * order;
      });
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = rows.slice((page - 1) * limit, page * limit);
    return send(res, 200, { data, meta: { total, page, limit, totalPages } });
  }

  if (route === "/sales" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const msgs = validateSale(body, true);
    if (msgs.length) return err(res, 400, "Bad Request", msgs);
    const fk = validateSaleFks(body, true);
    if (fk) return err(res, 422, "Unprocessable Entity", fk);
    const now = new Date().toISOString();
    const sale = {
      id: String(++saleSeq),
      leadId: String(body.leadId),
      unitId: null,
      projectId: String(body.projectId),
      executiveId: null,
      status: body.status ?? "EN_PROCESO",
      totalPrice: null,
      currency: "USD",
      downPayment: null,
      contractDate: null,
      financingTermMonths: null,
      interestRate: null,
      agreements: null,
      createdAt: now,
      updatedAt: now,
    };
    applySaleBody(sale, body);
    sales.unshift(sale);
    return send(res, 201, sale);
  }

  const saleIdMatch = route.match(/^\/sales\/([^/]+)$/);
  if (saleIdMatch) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = sales.findIndex((s) => s.id === saleIdMatch[1]);

    if (method === "GET") {
      if (idx === -1) return err(res, 404, "Not Found", "Venta no encontrada");
      return send(res, 200, sales[idx]);
    }
    if (method === "PATCH") {
      if (idx === -1) return err(res, 404, "Not Found", "Venta no encontrada");
      const body = await readBody(req);
      const msgs = validateSale(body, false);
      if (msgs.length) return err(res, 400, "Bad Request", msgs);
      const fk = validateSaleFks(body, false);
      if (fk) return err(res, 422, "Unprocessable Entity", fk);
      applySaleBody(sales[idx], body);
      sales[idx].updatedAt = new Date().toISOString();
      return send(res, 200, sales[idx]);
    }
    if (method === "DELETE") {
      if (idx === -1) return err(res, 404, "Not Found", "Venta no encontrada");
      sales.splice(idx, 1);
      return send(res, 200, { message: "Venta eliminada correctamente." });
    }
  }

  // ---------- Financing plans ----------
  if (route === "/financing-plans" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    const sortBy = q.sortBy ?? "createdAt";
    if (!FP_SORT.includes(sortBy))
      return err(res, 400, "Bad Request", [
        `sortBy must be one of the following values: ${FP_SORT.join(", ")}`,
      ]);
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    const rows = financingPlans
      .filter((p) => matchesPlan(p, q))
      .sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (av == null) return 1;
        if (bv == null) return -1;
        return String(av).localeCompare(String(bv)) * order;
      });
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = rows.slice((page - 1) * limit, page * limit);
    return send(res, 200, { data, meta: { total, page, limit, totalPages } });
  }

  if (route === "/financing-plans" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const msgs = validatePlan(body, true);
    if (msgs.length) return err(res, 400, "Bad Request", msgs);
    const now = new Date().toISOString();
    const plan = {
      id: String(++fpSeq),
      name: body.name,
      description: null,
      type: body.type,
      currency: "USD",
      downPaymentType: body.downPaymentType,
      downPaymentRequired: null,
      downPaymentPercent: null,
      installmentsCount: null,
      installmentAmount: null,
      frequency: "MENSUAL",
      termMonths: null,
      interestRate: null,
      cashDiscountPercent: null,
      minAmount: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    applyPlanBody(plan, body);
    financingPlans.unshift(plan);
    return send(res, 201, plan);
  }

  const fpActionMatch = route.match(
    /^\/financing-plans\/([^/]+)\/(activate|deactivate|clone)$/
  );
  if (fpActionMatch && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = financingPlans.findIndex((p) => p.id === fpActionMatch[1]);
    if (idx === -1)
      return err(res, 404, "Not Found", "Plan de financiamiento no encontrado");
    const action = fpActionMatch[2];
    if (action === "clone") {
      const src = financingPlans[idx];
      const now = new Date().toISOString();
      const copy = {
        ...src,
        id: String(++fpSeq),
        name: `${src.name} (copia)`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      financingPlans.unshift(copy);
      return send(res, 201, copy);
    }
    financingPlans[idx] = {
      ...financingPlans[idx],
      isActive: action === "activate",
      updatedAt: new Date().toISOString(),
    };
    return send(res, 200, financingPlans[idx]);
  }

  const fpIdMatch = route.match(/^\/financing-plans\/([^/]+)$/);
  if (fpIdMatch) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = financingPlans.findIndex((p) => p.id === fpIdMatch[1]);

    if (method === "GET") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Plan de financiamiento no encontrado");
      return send(res, 200, financingPlans[idx]);
    }
    if (method === "PATCH") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Plan de financiamiento no encontrado");
      const body = await readBody(req);
      const msgs = validatePlan(body, false);
      if (msgs.length) return err(res, 400, "Bad Request", msgs);
      applyPlanBody(financingPlans[idx], body);
      financingPlans[idx].updatedAt = new Date().toISOString();
      return send(res, 200, financingPlans[idx]);
    }
    if (method === "DELETE") {
      if (idx === -1)
        return err(res, 404, "Not Found", "Plan de financiamiento no encontrado");
      financingPlans.splice(idx, 1);
      return send(res, 200, {
        message: "Plan de financiamiento eliminado correctamente.",
      });
    }
  }

  // ========== RBAC: Permissions ==========
  if (route === "/permissions" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, [...permissions].sort((a, b) => a.code.localeCompare(b.code)));
  }
  if (route === "/permissions" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const m = [];
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(body.code || ""))
      m.push("code must follow the resource:action format (lowercase, e.g. leads:write)");
    if (!body.name || !String(body.name).trim()) m.push("name should not be empty");
    if (m.length) return err(res, 400, "Bad Request", m);
    if (permByCode(body.code))
      return err(res, 409, "Conflict", `A permission with code '${body.code}' already exists`);
    const p = { id: String(++permSeq), code: body.code, name: body.name, description: body.description ?? null, createdAt: nowIso(), updatedAt: nowIso() };
    permissions.push(p);
    return send(res, 201, p);
  }
  const permIdM = route.match(/^\/permissions\/([^/]+)$/);
  if (permIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = permissions.findIndex((p) => p.id === permIdM[1]);
    if (idx === -1 && method !== "GET") return err(res, 404, "Not Found", "Permission not found");
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.name !== undefined) permissions[idx].name = body.name;
      if (body.description !== undefined) permissions[idx].description = body.description;
      permissions[idx].updatedAt = nowIso();
      return send(res, 200, permissions[idx]);
    }
    if (method === "DELETE") {
      permissions.splice(idx, 1);
      return send(res, 200, { message: "Permission deleted successfully." });
    }
  }

  // ========== RBAC: Roles ==========
  const rolePermsM = route.match(/^\/roles\/([^/]+)\/permissions$/);
  if (rolePermsM && method === "PUT") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const role = roles.find((r) => r.id === rolePermsM[1]);
    if (!role) return err(res, 404, "Not Found", "Role not found");
    const body = await readBody(req);
    const ids = Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : null;
    if (!ids) return err(res, 400, "Bad Request", ["permissionIds must be an array"]);
    if (ids.some((id) => !permissions.find((p) => p.id === id)))
      return err(res, 422, "Unprocessable Entity", "One or more permissions do not exist");
    rolePerms.set(role.id, new Set(ids));
    return send(res, 200, { ...role, permissions: permissions.filter((p) => rolePerms.get(role.id).has(p.id)) });
  }
  if (route === "/roles" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, roles);
  }
  if (route === "/roles" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!ROLE_DEFS.some(([c]) => c === body.code))
      return err(res, 400, "Bad Request", [`code must be one of the following values: ${ROLE_DEFS.map((d) => d[0]).join(", ")}`]);
    if (!body.name) return err(res, 400, "Bad Request", ["name should not be empty"]);
    if (roleByCode(body.code))
      return err(res, 409, "Conflict", `A role with code '${body.code}' already exists`);
    const r = { id: String(++roleSeq), code: body.code, name: body.name, description: body.description ?? null, createdAt: nowIso(), updatedAt: nowIso() };
    roles.push(r);
    rolePerms.set(r.id, new Set());
    return send(res, 201, r);
  }
  const roleIdM = route.match(/^\/roles\/([^/]+)$/);
  if (roleIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = roles.findIndex((r) => r.id === roleIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Role not found");
    if (method === "GET")
      return send(res, 200, { ...roles[idx], permissions: permissions.filter((p) => rolePerms.get(roles[idx].id)?.has(p.id)) });
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.name !== undefined) roles[idx].name = body.name;
      if (body.description !== undefined) roles[idx].description = body.description;
      roles[idx].updatedAt = nowIso();
      return send(res, 200, roles[idx]);
    }
    if (method === "DELETE") {
      roles.splice(idx, 1);
      return send(res, 200, { message: "Role deleted successfully." });
    }
  }

  // ========== RBAC: Users (+ schedule, exceptions sub-resources) ==========
  const userSchedM = route.match(/^\/users\/([^/]+)\/schedule$/);
  if (userSchedM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const uid = userSchedM[1];
    if (!users.find((u) => u.id === uid)) return err(res, 404, "Not Found", "Usuario no encontrado");
    if (method === "GET") return send(res, 200, userSchedules.get(uid) ?? []);
    if (method === "PUT") {
      const body = await readBody(req);
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const wins = entries.map((e) => ({
        id: String(++schedSeq), userId: uid, dayOfWeek: e.dayOfWeek,
        startTime: e.startTime.length === 5 ? `${e.startTime}:00` : e.startTime,
        endTime: e.endTime.length === 5 ? `${e.endTime}:00` : e.endTime,
        isActive: e.isActive ?? true, createdAt: nowIso(), updatedAt: nowIso(),
      }));
      userSchedules.set(uid, wins);
      return send(res, 200, wins);
    }
  }
  const userExcM = route.match(/^\/users\/([^/]+)\/availability-exceptions$/);
  if (userExcM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const uid = userExcM[1];
    if (!users.find((u) => u.id === uid)) return err(res, 404, "Not Found", "Usuario no encontrado");
    if (method === "GET") {
      const q = Object.fromEntries(url.searchParams);
      let rows = exceptions.filter((e) => e.userId === uid || (q.includeGlobal !== "false" && e.userId === null));
      if (q.status) rows = rows.filter((e) => e.status === q.status);
      if (q.type) rows = rows.filter((e) => e.type === q.type);
      const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
      rows = rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
      const total = rows.length;
      return send(res, 200, { data: rows.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    }
    if (method === "POST") {
      const body = await readBody(req);
      const m = [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || "")) m.push("startDate debe tener formato YYYY-MM-DD");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.endDate || "")) m.push("endDate debe tener formato YYYY-MM-DD");
      if (m.length) return err(res, 400, "Bad Request", m);
      if (body.endDate < body.startDate) return err(res, 422, "Unprocessable Entity", "endDate debe ser igual o posterior a startDate.");
      const allDay = body.isAllDay ?? true;
      if (!allDay && (!body.startTime || !body.endTime)) return err(res, 422, "Unprocessable Entity", "startTime y endTime son obligatorios cuando isAllDay=false.");
      const status = AUTO_APPROVE.has(body.type) ? "APROBADO" : "PENDIENTE";
      const exc = {
        id: String(++excSeq), userId: uid, type: body.type, effect: body.effect ?? "BLOQUEA",
        startDate: body.startDate, endDate: body.endDate, isAllDay: allDay,
        startTime: allDay ? null : body.startTime, endTime: allDay ? null : body.endTime,
        reason: body.reason ?? null, notes: body.notes ?? null, status,
        requestedByUserId: "1", approvedByUserId: status === "APROBADO" ? "1" : null,
        approvedAt: status === "APROBADO" ? nowIso() : null, createdAt: nowIso(), updatedAt: nowIso(),
      };
      exceptions.unshift(exc);
      return send(res, 201, exc);
    }
  }
  if (route === "/users" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    const sortBy = q.sortBy ?? "createdAt";
    if (!USER_SORT.includes(sortBy)) return err(res, 400, "Bad Request", [`sortBy must be one of the following values: ${USER_SORT.join(", ")}`]);
    let rows = [...users];
    if (q.search) { const s = q.search.toLowerCase(); rows = rows.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(s)); }
    if (q.roleId) rows = rows.filter((u) => u.roleId === q.roleId);
    if (q.isActive === "true") rows = rows.filter((u) => u.isActive);
    if (q.isActive === "false") rows = rows.filter((u) => !u.isActive);
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    rows.sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy])) * order);
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const total = rows.length;
    return send(res, 200, { data: rows.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  }
  if (route === "/users" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const m = [];
    if (!body.firstName) m.push("firstName should not be empty");
    if (!body.lastName) m.push("lastName should not be empty");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) m.push("email must be an email");
    if (!body.password || String(body.password).length < 8) m.push("password must be longer than or equal to 8 characters");
    if (m.length) return err(res, 400, "Bad Request", m);
    if (users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase()))
      return err(res, 409, "Conflict", "A user with that email already exists");
    if (!roles.find((r) => r.id === String(body.roleId)))
      return err(res, 422, "Unprocessable Entity", "The specified role does not exist");
    const u = {
      id: String(++userSeq), firstName: body.firstName, lastName: body.lastName, email: body.email,
      phone: body.phone ?? null, roleId: String(body.roleId), department: body.department ?? null,
      isActive: true, lastLoginAt: null, img: body.img ?? null, createdAt: nowIso(), updatedAt: nowIso(),
    };
    users.unshift(u);
    return send(res, 201, u);
  }
  const userIdM = route.match(/^\/users\/([^/]+)$/);
  if (userIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = users.findIndex((u) => u.id === userIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "User not found");
    if (method === "GET") return send(res, 200, users[idx]);
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.email && users.some((u) => u.id !== users[idx].id && u.email.toLowerCase() === String(body.email).toLowerCase()))
        return err(res, 409, "Conflict", "A user with that email already exists");
      if (body.roleId && !roles.find((r) => r.id === String(body.roleId)))
        return err(res, 422, "Unprocessable Entity", "The specified role does not exist");
      for (const k of ["firstName", "lastName", "email", "phone", "department", "isActive", "img"])
        if (body[k] !== undefined) users[idx][k] = body[k];
      if (body.roleId !== undefined) users[idx].roleId = String(body.roleId);
      users[idx].updatedAt = nowIso();
      return send(res, 200, users[idx]);
    }
    if (method === "DELETE") {
      users.splice(idx, 1);
      return send(res, 200, { message: "User deleted successfully." });
    }
  }

  // ========== Availability exceptions (by id) + approve/reject ==========
  const excDecideM = route.match(/^\/availability-exceptions\/([^/]+)\/(approve|reject)$/);
  if (excDecideM && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const e = exceptions.find((x) => x.id === excDecideM[1]);
    if (!e) return err(res, 404, "Not Found", "Excepción de disponibilidad no encontrada");
    e.status = excDecideM[2] === "approve" ? "APROBADO" : "RECHAZADO";
    e.approvedByUserId = "1";
    e.approvedAt = nowIso();
    e.updatedAt = nowIso();
    return send(res, 200, e);
  }
  const excIdM = route.match(/^\/availability-exceptions\/([^/]+)$/);
  if (excIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = exceptions.findIndex((x) => x.id === excIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Excepción de disponibilidad no encontrada");
    if (method === "GET") return send(res, 200, exceptions[idx]);
    if (method === "PATCH") {
      const body = await readBody(req);
      for (const k of ["type", "effect", "startDate", "endDate", "isAllDay", "startTime", "endTime", "reason", "notes"])
        if (body[k] !== undefined) exceptions[idx][k] = body[k];
      exceptions[idx].updatedAt = nowIso();
      return send(res, 200, exceptions[idx]);
    }
    if (method === "DELETE") {
      exceptions.splice(idx, 1);
      return send(res, 200, { message: "Excepción eliminada correctamente." });
    }
  }
  if (route === "/availability/executives" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from || "")) return err(res, 400, "Bad Request", ["from debe tener formato YYYY-MM-DD"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.to || "")) return err(res, 400, "Bad Request", ["to debe tener formato YYYY-MM-DD"]);
    if (q.to < q.from) return err(res, 422, "Unprocessable Entity", 'La fecha "to" debe ser igual o posterior a "from".');
    const execs = users.filter((u) => roles.find((r) => r.id === u.roleId)?.code === "EJECUTIVO_VENTAS" && (!q.executiveId || u.id === q.executiveId));
    const dates = [];
    for (let d = new Date(`${q.from}T00:00:00Z`); d <= new Date(`${q.to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) dates.push(new Date(d));
    return send(res, 200, {
      from: q.from, to: q.to,
      executives: execs.map((u) => {
        const wins = userSchedules.get(u.id) ?? [];
        return {
          executiveId: u.id, executiveName: `${u.firstName} ${u.lastName}`,
          days: dates.map((dt) => {
            const dow = dt.getUTCDay();
            const dayWins = wins.filter((w) => w.dayOfWeek === dow && w.isActive).map((w) => ({ start: w.startTime.slice(0, 5), end: w.endTime.slice(0, 5) }));
            return { date: dt.toISOString().slice(0, 10), dayOfWeek: dow, available: dayWins.length > 0, windows: dayWins };
          }),
        };
      }),
    });
  }

  // ========== API clients / scopes ==========
  const clientScopesM = route.match(/^\/api-clients\/([^/]+)\/scopes$/);
  if (clientScopesM && method === "PUT") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const c = apiClients.find((x) => x.id === clientScopesM[1]);
    if (!c) return err(res, 404, "Not Found", "API client not found");
    const body = await readBody(req);
    const ids = Array.isArray(body.scopeIds) ? body.scopeIds.map(String) : null;
    if (!ids) return err(res, 400, "Bad Request", ["scopeIds must be an array"]);
    if (ids.some((id) => !apiScopes.find((s) => s.id === id)))
      return err(res, 422, "Unprocessable Entity", "One or more scopes do not exist");
    apiClientScopes.set(c.id, new Set(ids));
    return send(res, 200, clientWithScopes(c));
  }
  if (route === "/api-clients" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, apiClients);
  }
  if (route === "/api-clients" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!body.name || !String(body.name).trim()) return err(res, 400, "Bad Request", ["name should not be empty"]);
    const ids = Array.isArray(body.scopeIds) ? body.scopeIds.map(String) : [];
    if (ids.some((id) => !apiScopes.find((s) => s.id === id)))
      return err(res, 422, "Unprocessable Entity", "One or more scopes do not exist");
    const id = String(++apiClientSeq);
    const c = { id, name: body.name, keyPrefix: `nk_${1000 + apiClientSeq}`, isActive: true, lastUsedAt: null, createdAt: nowIso(), updatedAt: nowIso() };
    apiClients.unshift(c);
    apiClientScopes.set(id, new Set(ids));
    return send(res, 201, { ...clientWithScopes(c), apiKey: `nk_${1000 + apiClientSeq}.${Math.random().toString(36).slice(2)}secret` });
  }
  const clientIdM = route.match(/^\/api-clients\/([^/]+)$/);
  if (clientIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = apiClients.findIndex((c) => c.id === clientIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "API client not found");
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.name !== undefined) apiClients[idx].name = body.name;
      if (body.isActive !== undefined) apiClients[idx].isActive = body.isActive;
      apiClients[idx].updatedAt = nowIso();
      return send(res, 200, apiClients[idx]);
    }
    if (method === "DELETE") {
      apiClients.splice(idx, 1);
      return send(res, 200, { message: "API client revoked successfully." });
    }
  }
  if (route === "/api-scopes" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, apiScopes);
  }
  if (route === "/api-scopes" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(body.code || ""))
      return err(res, 400, "Bad Request", ["code must follow the resource:action format (e.g. leads:write)"]);
    if (apiScopes.find((s) => s.code === body.code))
      return err(res, 409, "Conflict", `A scope with code '${body.code}' already exists`);
    const s = { id: String(++scopeSeq), code: body.code, description: body.description ?? null, createdAt: nowIso(), updatedAt: nowIso() };
    apiScopes.push(s);
    return send(res, 201, s);
  }

  // ========== Knowledge base ==========
  if (route === "/knowledge-base/ai-draft" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!body.topic || !String(body.topic).trim()) return err(res, 400, "Bad Request", ["topic should not be empty"]);
    return send(res, 200, {
      title: `${String(body.topic).slice(0, 80)}`,
      content: `Borrador generado para "${body.topic}".\n\nEste es contenido de demostración del asistente IA. Revísalo y edítalo antes de guardar.`,
    });
  }
  if (route === "/knowledge-base" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    const sortBy = q.sortBy ?? "priority";
    if (!KB_SORT.includes(sortBy)) return err(res, 400, "Bad Request", [`sortBy must be one of the following values: ${KB_SORT.join(", ")}`]);
    let rows = [...kbEntries];
    if (q.search) { const s = q.search.toLowerCase(); rows = rows.filter((e) => `${e.title} ${e.content}`.toLowerCase().includes(s)); }
    if (q.categoryId) rows = rows.filter((e) => e.categoryId === q.categoryId);
    if (q.brand) rows = rows.filter((e) => e.brand === q.brand);
    if (q.tag) rows = rows.filter((e) => e.tags.some((t) => t.name === q.tag));
    if (q.isActive === "true") rows = rows.filter((e) => e.isActive);
    if (q.isActive === "false") rows = rows.filter((e) => !e.isActive);
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    rows.sort((a, b) => (sortBy === "priority" ? (a.priority - b.priority) * order : String(a[sortBy]).localeCompare(String(b[sortBy])) * order));
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const total = rows.length;
    return send(res, 200, { data: rows.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  }
  if (route === "/knowledge-base" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const m = [];
    if (!body.title || !String(body.title).trim()) m.push("title should not be empty");
    if (!body.content || !String(body.content).trim()) m.push("content should not be empty");
    if (m.length) return err(res, 400, "Bad Request", m);
    if (body.categoryId && !kbCategories.find((c) => c.id === body.categoryId))
      return err(res, 422, "Unprocessable Entity", "Category does not exist");
    const tagIds = body.tagIds ?? [];
    const missing = tagIds.filter((id) => !kbTags.find((t) => t.id === id));
    if (missing.length) return err(res, 422, "Unprocessable Entity", `Tags do not exist: ${missing.join(", ")}`);
    const cat = kbCategories.find((c) => c.id === body.categoryId) ?? null;
    const e = {
      id: String(++kbSeq), title: body.title, content: body.content,
      categoryId: body.categoryId ?? null, category: cat ? { id: cat.id, code: cat.code, name: cat.name } : null,
      projectId: body.projectId ?? null, brand: body.brand ?? null, isActive: body.isActive ?? true,
      priority: body.priority ?? 0, source: "MANUAL", mediaUrls: body.mediaUrls ?? null,
      tags: kbTags.filter((t) => tagIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name })),
      createdByUserId: "1", updatedByUserId: null, createdAt: nowIso(), updatedAt: nowIso(),
    };
    kbEntries.unshift(e);
    return send(res, 201, e);
  }
  const kbIdM = route.match(/^\/knowledge-base\/([^/]+)$/);
  if (kbIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = kbEntries.findIndex((e) => e.id === kbIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Knowledge entry not found");
    if (method === "GET") return send(res, 200, kbEntries[idx]);
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.categoryId !== undefined && body.categoryId && !kbCategories.find((c) => c.id === body.categoryId))
        return err(res, 422, "Unprocessable Entity", "Category does not exist");
      if (body.tagIds) {
        const missing = body.tagIds.filter((id) => !kbTags.find((t) => t.id === id));
        if (missing.length) return err(res, 422, "Unprocessable Entity", `Tags do not exist: ${missing.join(", ")}`);
        kbEntries[idx].tags = kbTags.filter((t) => body.tagIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name }));
      }
      for (const k of ["title", "content", "projectId", "brand", "isActive", "priority", "mediaUrls"])
        if (body[k] !== undefined) kbEntries[idx][k] = body[k];
      if (body.categoryId !== undefined) {
        kbEntries[idx].categoryId = body.categoryId ?? null;
        const c = kbCategories.find((x) => x.id === body.categoryId);
        kbEntries[idx].category = c ? { id: c.id, code: c.code, name: c.name } : null;
      }
      kbEntries[idx].updatedByUserId = "1";
      kbEntries[idx].updatedAt = nowIso();
      return send(res, 200, kbEntries[idx]);
    }
    if (method === "DELETE") {
      kbEntries.splice(idx, 1);
      return send(res, 200, { message: "Knowledge entry deleted successfully." });
    }
  }
  if (route === "/kb-categories" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, kbCategories);
  }
  if (route === "/kb-categories" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!/^[A-Z0-9_]+$/.test(body.code || "")) return err(res, 400, "Bad Request", ["code must contain only A-Z, 0-9 and underscore"]);
    if (!body.name) return err(res, 400, "Bad Request", ["name should not be empty"]);
    if (kbCategories.find((c) => c.code === body.code)) return err(res, 409, "Conflict", "A category with that code already exists");
    const c = { id: String(++kbCatSeq), code: body.code, name: body.name, createdAt: nowIso(), updatedAt: nowIso() };
    kbCategories.push(c);
    return send(res, 201, c);
  }
  const kbCatIdM = route.match(/^\/kb-categories\/([^/]+)$/);
  if (kbCatIdM) {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = kbCategories.findIndex((c) => c.id === kbCatIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Category not found");
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.name !== undefined) kbCategories[idx].name = body.name;
      kbCategories[idx].updatedAt = nowIso();
      return send(res, 200, kbCategories[idx]);
    }
    if (method === "DELETE") {
      kbCategories.splice(idx, 1);
      return send(res, 200, { message: "Category deleted successfully." });
    }
  }
  if (route === "/kb-tags" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    return send(res, 200, kbTags);
  }
  if (route === "/kb-tags" && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    if (!body.name || !String(body.name).trim()) return err(res, 400, "Bad Request", ["name should not be empty"]);
    const name = String(body.name).trim().toLowerCase();
    if (kbTags.find((t) => t.name === name)) return err(res, 409, "Conflict", "A tag with that name already exists");
    const t = { id: String(++kbTagSeq), name, createdAt: nowIso(), updatedAt: nowIso() };
    kbTags.push(t);
    return send(res, 201, t);
  }
  const kbTagIdM = route.match(/^\/kb-tags\/([^/]+)$/);
  if (kbTagIdM && method === "DELETE") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const idx = kbTags.findIndex((t) => t.id === kbTagIdM[1]);
    if (idx === -1) return err(res, 404, "Not Found", "Tag not found");
    kbTags.splice(idx, 1);
    return send(res, 200, { message: "Tag deleted successfully." });
  }

  // ========== Activity log ==========
  if (route === "/activity-log" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    let rows = [...activityLog];
    if (q.actorType) rows = rows.filter((e) => e.actorType === q.actorType);
    if (q.entityType) rows = rows.filter((e) => e.entityType === q.entityType);
    if (q.entityId) rows = rows.filter((e) => e.entityId === q.entityId);
    if (q.dateFrom) rows = rows.filter((e) => e.createdAt >= q.dateFrom);
    if (q.dateTo) rows = rows.filter((e) => e.createdAt <= q.dateTo);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const total = rows.length;
    return send(res, 200, { data: rows.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  }

  // ========== Notifications (list + mark) ==========
  if (route === "/notifications/read-all" && method === "PATCH") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    let updated = 0;
    for (const n of notifications) if (!n.isRead) { n.isRead = true; n.readAt = nowIso(); updated++; }
    return send(res, 200, { updated });
  }
  const notifReadM = route.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifReadM && method === "PATCH") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const n = notifications.find((x) => x.id === notifReadM[1]);
    if (!n) return err(res, 404, "Not Found", "Notificación no encontrada");
    n.isRead = true;
    n.readAt = n.readAt ?? nowIso();
    return send(res, 200, { message: "Notificación marcada como leída." });
  }
  if (route === "/notifications" && method === "GET") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const q = Object.fromEntries(url.searchParams);
    let rows = [...notifications];
    if (q.isRead === "true") rows = rows.filter((n) => n.isRead);
    if (q.isRead === "false") rows = rows.filter((n) => !n.isRead);
    if (q.type) rows = rows.filter((n) => n.type === q.type);
    const order = (q.sortOrder ?? "DESC").toUpperCase() === "ASC" ? 1 : -1;
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * order);
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const total = rows.length;
    return send(res, 200, { data: rows.slice((page - 1) * limit, page * limit), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  }

  // ========== Uploads ==========
  if ((route === "/uploads/image" || route === "/uploads/images") && method === "POST") {
    if (!bearer(req)) return err(res, 401, "Unauthorized", "Unauthorized");
    const body = await readBody(req);
    const mock = (i) => `https://res.cloudinary.com/negoinversiones/image/upload/v1/mock-${Date.now()}-${i}.jpg`;
    if (route === "/uploads/image") {
      if (!body.imageBase64) return err(res, 400, "Bad Request", ["imageBase64 should not be empty"]);
      return send(res, 201, { url: mock(0) });
    }
    const arr = Array.isArray(body.imagesBase64) ? body.imagesBase64 : [];
    return send(res, 201, { urls: arr.map((_, i) => mock(i)) });
  }

  return err(res, 404, "Not Found", "Resource not found");
});

server.listen(PORT, () => {
  console.log(`🟢 Mock API escuchando en http://localhost:${PORT}${PREFIX}`);
  console.log(`   Login demo: ${DEMO.email} / ${DEMO.password}`);
});
