/**
 * Supabase REST API Client that mimics Prisma Client interface.
 * Uses PostgREST API over HTTPS to work in environments where
 * direct PostgreSQL connections are blocked.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ============================================================
// Configuration
// ============================================================

interface RelationConfig {
  table: string
  foreignKey: string
  isList: boolean
}

interface ModelConfig {
  tableName: string
  uniqueFields: string[]
  uniqueConstraints: Record<string, string[]>
  relations: Record<string, RelationConfig>
}

const MODELS: Record<string, ModelConfig> = {
  rombel: {
    tableName: 'rombel',
    uniqueFields: ['id'],
    uniqueConstraints: {},
    relations: {
      siswa: { table: 'siswa', foreignKey: 'rombelid', isList: true },
    },
  },
  siswa: {
    tableName: 'siswa',
    uniqueFields: ['id', 'nis'],
    uniqueConstraints: {},
    relations: {
      rombel: { table: 'rombel', foreignKey: 'rombelid', isList: false },
      nilai: { table: 'nilai', foreignKey: 'siswaid', isList: true },
      eligible: { table: 'eligible', foreignKey: 'siswaid', isList: false },
      tka: { table: 'tka', foreignKey: 'siswaid', isList: false },
    },
  },
  nilai: {
    tableName: 'nilai',
    uniqueFields: ['id'],
    uniqueConstraints: {
      siswaid_matapelajaran: ['siswaid', 'matapelajaran'],
    },
    relations: {
      siswa: { table: 'siswa', foreignKey: 'siswaid', isList: false },
    },
  },
  eligible: {
    tableName: 'eligible',
    uniqueFields: ['id', 'siswaid'],
    uniqueConstraints: {},
    relations: {
      siswa: { table: 'siswa', foreignKey: 'siswaid', isList: false },
    },
  },
  tka: {
    tableName: 'tka',
    uniqueFields: ['id', 'siswaid'],
    uniqueConstraints: {},
    relations: {
      siswa: { table: 'siswa', foreignKey: 'siswaid', isList: false },
    },
  },
  admin: {
    tableName: 'admin',
    uniqueFields: ['id', 'username'],
    uniqueConstraints: {},
    relations: {},
  },
}

// ============================================================
// SupabaseModel — Prisma-like interface backed by PostgREST
// ============================================================

type AnyRecord = Record<string, any>

class SupabaseModel {
  private tableName: string
  private config: ModelConfig

  constructor(modelName: string) {
    this.config = MODELS[modelName]
    this.tableName = this.config.tableName
  }

  // ---- HTTP helpers ----

  private headers(prefer?: string): Record<string, string> {
    const h: Record<string, string> = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }
    if (prefer) h['Prefer'] = prefer
    return h
  }

  private async request(
    method: string,
    params?: URLSearchParams,
    body?: unknown,
    prefer?: string,
  ): Promise<any> {
    const qs = params ? `?${params.toString()}` : ''
    const url = `${SUPABASE_URL}/rest/v1/${this.tableName}${qs}`

    const res = await fetch(url, {
      method,
      headers: this.headers(prefer),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[SupabaseDB] ${method} ${url} → ${res.status}: ${text}`)
      throw new Error(`Supabase REST error ${res.status}: ${text}`)
    }

    const text = await res.text()
    if (!text) return null

    // Also return content-range header for count queries
    const contentRange = res.headers.get('content-range')
    const parsed = JSON.parse(text)
    return { _data: parsed, _contentRange: contentRange }
  }

  // ---- Select builder ----

  private buildSelect(include?: AnyRecord, select?: AnyRecord): string {
    if (select) {
      const fields = Object.entries(select)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
      return fields.join(',')
    }

    const parts: string[] = ['*']

    if (include) {
      for (const [key, value] of Object.entries(include)) {
        if (key === '_count') continue // handled separately
        parts.push(this.buildRelationSelect(key, value))
      }
    }

    return parts.join(',')
  }

  private buildRelationSelect(key: string, value: any): string {
    if (value === true) {
      return `${key}(*)`
    }
    if (typeof value === 'object' && value !== null) {
      // value can be { select: { id: true } } or { include: { rombel: true } }
      // or a mix like { include: { rombel: true } } on siswa
      if ('select' in value && !('include' in value)) {
        const fields = Object.entries(value.select as AnyRecord)
          .filter(([, v]: [string, any]) => v === true)
          .map(([k]: [string, any]) => k)
          .join(',')
        return `${key}(${fields})`
      }

      // Build nested select with *
      const innerParts: string[] = ['*']
      if (value.include) {
        for (const [ik, iv] of Object.entries(value.include as AnyRecord)) {
          if (ik === '_count') continue
          innerParts.push(this.buildRelationSelect(ik, iv))
        }
      }
      if (value.select) {
        // If there's also a select, add those fields
        for (const [ik, iv] of Object.entries(value.select as AnyRecord)) {
          if (iv === true && !innerParts.includes(ik)) {
            innerParts.push(ik)
          }
        }
      }
      return `${key}(${innerParts.join(',')})`
    }
    return `${key}(*)`
  }

  // ---- Where / filter builder ----

  private buildWhereParams(
    where: AnyRecord,
    params: URLSearchParams,
    innerJoins: Set<string>,
  ): void {
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined || value === null) continue

      if (key === 'OR') {
        const orParts: string[] = []
        for (const cond of value as AnyRecord[]) {
          for (const [field, fieldValue] of Object.entries(cond)) {
            orParts.push(this.formatFilter(field, fieldValue))
          }
        }
        params.set('or', `(${orParts.join(',')})`)
      } else if (key === 'AND') {
        // AND is the default in PostgREST; just flatten
        for (const cond of value as AnyRecord[]) {
          this.buildWhereParams(cond, params, innerJoins)
        }
      } else if (this.config.relations[key]) {
        // Relation filter → inner join + filter on related table
        innerJoins.add(key)
        const relWhere = value as AnyRecord
        for (const [rf, rv] of Object.entries(relWhere)) {
          params.append(`${key}.${rf}`, this.formatOp(rv))
        }
      } else {
        params.append(key, this.formatOp(value))
      }
    }
  }

  /** Format a single where value into a PostgREST operator string (without the key). */
  private formatOp(value: any): string {
    if (typeof value === 'object' && value !== null) {
      if ('contains' in value) return `ilike.*${value.contains}*`
      if ('in' in value) return `in.(${(value.in as any[]).map(String).join(',')})`
      if ('not' in value) return `neq.${value.not}`
      if ('gt' in value) return `gt.${value.gt}`
      if ('lt' in value) return `lt.${value.lt}`
      if ('gte' in value) return `gte.${value.gte}`
      if ('lte' in value) return `lte.${value.lte}`
      if ('startsWith' in value) return `like.${value.startsWith}*`
      if ('endsWith' in value) return `like.*${value.endsWith}`
      if ('equals' in value) return `eq.${value.equals}`
    }
    return `eq.${value}`
  }

  /** Format `key=op.value` as a single string (used inside OR). */
  private formatFilter(key: string, value: any): string {
    return `${key}.${this.formatOp(value)}`
  }

  /** Apply `!inner` to relation selects that are used for filtering. */
  private applyInnerJoins(select: string, innerJoins: Set<string>): string {
    for (const join of innerJoins) {
      // Replace `join(...)` → `join!inner(...)`
      const plain = `${join}(`
      const inner = `${join}!inner(`
      if (select.includes(plain) && !select.includes(inner)) {
        select = select.replace(plain, inner)
      } else if (!select.includes(inner)) {
        // Relation not in select yet — add it
        select += `,${join}!inner(*)`
      }
    }
    return select
  }

  // ---- Result transformers ----

  private transformRow(
    row: AnyRecord,
    include?: AnyRecord,
    isCountQuery?: boolean,
  ): AnyRecord {
    if (!include) return row
    const result = { ...row }

    // Handle _count: convert [{count:N}] → { siswa: N }
    if ('_count' in include) {
      const countCfg = include._count as AnyRecord
      if (countCfg.select) {
        const countResult: AnyRecord = {}
        for (const field of Object.keys(countCfg.select)) {
          const raw = result[field]
          if (Array.isArray(raw) && raw.length > 0 && 'count' in raw[0]) {
            countResult[field] = parseInt(String(raw[0].count), 10) || 0
          } else {
            countResult[field] = 0
          }
          // Remove raw count data unless the field was also in include
          if (!include[field]) {
            delete result[field]
          }
        }
        result._count = countResult
      }
    }

    return result
  }

  // ============================================================
  // Public API — mirrors Prisma Client methods
  // ============================================================

  async findMany(opts: {
    where?: AnyRecord
    select?: AnyRecord
    include?: AnyRecord
    orderBy?: AnyRecord[] | AnyRecord
    take?: number
    skip?: number
    distinct?: string[]
  } = {}): Promise<AnyRecord[]> {
    // Normalize orderBy: Prisma accepts both array and object
    let { where, select, include, orderBy, take, skip, distinct } = opts
    if (orderBy && !Array.isArray(orderBy)) {
      orderBy = [orderBy]
    }
    const params = new URLSearchParams()
    const innerJoins = new Set<string>()

    // select
    let selectStr = this.buildSelect(include, select)

    // where
    if (where) this.buildWhereParams(where, params, innerJoins)

    // inner-join modifiers
    selectStr = this.applyInnerJoins(selectStr, innerJoins)

    // _count handling — change relation(*) to relation(count)
    if (include && '_count' in include) {
      const countCfg = include._count as AnyRecord
      if (countCfg.select) {
        for (const field of Object.keys(countCfg.select)) {
          // Replace existing relation select with count
          const patterns = [`${field}(*)`, `${field}!inner(*)`]
          const countPat = `${field}(count)`
          const innerCountPat = `${field}!inner(count)`
          let replaced = false
          for (const p of patterns) {
            if (selectStr.includes(p)) {
              const replacement = p.includes('!inner') ? innerCountPat : countPat
              selectStr = selectStr.replace(p, replacement)
              replaced = true
              break
            }
          }
          if (!replaced) {
            selectStr += `,${countPat}`
          }
        }
      }
    }

    params.set('select', selectStr)

    // orderBy (top-level only; nested sorted in JS)
    if (orderBy) {
      const orderParts: string[] = []
      const orderArr = orderBy as AnyRecord[]
      const hasNested = orderArr.some(
        (o) => Object.values(o).some((v) => typeof v === 'object' && v !== null),
      )
      for (const item of orderArr) {
        for (const [field, dir] of Object.entries(item)) {
          if (typeof dir === 'string') {
            orderParts.push(`${field}.${dir}`)
          }
          // nested orderBy handled below in JS
        }
      }
      if (orderParts.length > 0) params.set('order', orderParts.join(','))
    }

    // pagination
    if (take !== undefined) params.set('limit', String(take))
    if (skip !== undefined) params.set('offset', String(skip))

    // execute
    const raw = await this.request('GET', params)
    let rows: AnyRecord[] = Array.isArray(raw?._data) ? raw._data : raw?._data ? [raw._data] : []

    // nested orderBy (sort in JS)
    if (orderBy) {
      for (const item of orderBy as AnyRecord[]) {
        for (const [field, dir] of Object.entries(item)) {
          if (typeof dir === 'object' && dir !== null) {
            for (const [nf, nd] of Object.entries(dir as AnyRecord)) {
              rows.sort((a, b) => {
                const av = (a[field] as AnyRecord)?.[nf]
                const bv = (b[field] as AnyRecord)?.[nf]
                if (av == null && bv == null) return 0
                if (av == null) return 1
                if (bv == null) return -1
                const cmp = typeof av === 'number' && typeof bv === 'number'
                  ? av - bv
                  : String(av).localeCompare(String(bv))
                return nd === 'desc' ? -cmp : cmp
              })
            }
          }
        }
      }
    }

    // distinct (deduplicate in JS)
    if (distinct && distinct.length > 0) {
      const seen = new Set<string>()
      rows = rows.filter((row) => {
        const key = distinct.map((f) => String(row[f])).join('\0')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return rows.map((r) => this.transformRow(r, include))
  }

  async findFirst(opts: {
    where?: AnyRecord
    include?: AnyRecord
    select?: AnyRecord
  } = {}): Promise<AnyRecord | null> {
    const results = await this.findMany({ ...opts, take: 1 })
    return results.length > 0 ? results[0] : null
  }

  async findUnique(opts: {
    where: AnyRecord
    include?: AnyRecord
  }): Promise<AnyRecord | null> {
    const { where, include } = opts
    const params = new URLSearchParams()

    // flatten composite unique keys
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value as AnyRecord)) {
          params.append(k, `eq.${v}`)
        }
      } else {
        params.append(key, `eq.${value}`)
      }
    }

    params.set('select', this.buildSelect(include))
    params.set('limit', '1')

    const raw = await this.request('GET', params)
    const rows: AnyRecord[] = Array.isArray(raw?._data) ? raw._data : raw?._data ? [raw._data] : []
    if (rows.length === 0) return null
    return this.transformRow(rows[0], include)
  }

  async count(opts: { where?: AnyRecord } = {}): Promise<number> {
    const { where } = opts
    const params = new URLSearchParams()
    const innerJoins = new Set<string>()

    if (where) this.buildWhereParams(where, params, innerJoins)

    // If there are relation filters we need inner joins
    if (innerJoins.size > 0) {
      // Fetch IDs with inner joins and count
      let selectStr = 'id'
      for (const join of innerJoins) {
        selectStr += `,${join}!inner(id)`
      }
      params.set('select', selectStr)

      const raw = await this.request('GET', params)
      const rows = Array.isArray(raw?._data) ? raw._data : []
      return rows.length
    }

    // Use HEAD with count=exact for simple counts
    params.set('select', 'id')
    const qs = params.toString()
    const url = `${SUPABASE_URL}/rest/v1/${this.tableName}?${qs}`

    const res = await fetch(url, {
      method: 'HEAD',
      headers: { ...this.headers(), Prefer: 'count=exact' },
    })

    if (res.ok) {
      const cr = res.headers.get('content-range')
      if (cr) {
        const total = cr.split('/')[1]
        if (total && total !== '*') return parseInt(total, 10)
      }
    }

    // Fallback: GET and count rows
    const raw = await this.request('GET', params)
    return Array.isArray(raw?._data) ? raw._data.length : 0
  }

  async create(opts: { data: AnyRecord; include?: AnyRecord }): Promise<AnyRecord> {
    const { data, include } = opts
    if (!('updatedat' in data)) data.updatedat = new Date().toISOString()

    const params = new URLSearchParams()
    if (include) params.set('select', this.buildSelect(include))

    const raw = await this.request(
      'POST',
      params.toString() ? params : undefined,
      data,
      'return=representation',
    )
    const row = Array.isArray(raw?._data) ? raw._data[0] : raw?._data ?? data
    return this.transformRow(row, include)
  }

  async createMany(opts: { data: AnyRecord[] }): Promise<{ count: number }> {
    const items = opts.data
    for (const item of items) {
      if (!('updatedat' in item)) item.updatedat = new Date().toISOString()
    }
    await this.request('POST', undefined, items, 'return=representation')
    return { count: items.length }
  }

  async update(opts: {
    where: AnyRecord
    data: AnyRecord
    include?: AnyRecord
  }): Promise<AnyRecord> {
    const { where, data: updateData, include } = opts
    updateData.updatedat = new Date().toISOString()

    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(where)) {
      params.append(key, `eq.${value}`)
    }

    if (include) params.set('select', this.buildSelect(include))

    const raw = await this.request('PATCH', params, updateData, 'return=representation')
    const row = Array.isArray(raw?._data) ? raw._data[0] : raw?._data ?? updateData
    return this.transformRow(row, include)
  }

  async delete(opts: { where: AnyRecord }): Promise<AnyRecord> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(opts.where)) {
      params.append(key, `eq.${value}`)
    }
    const raw = await this.request('DELETE', params, undefined, 'return=representation')
    return raw?._data ?? { success: true }
  }

  async deleteMany(opts: { where?: AnyRecord } = {}): Promise<{ count: number }> {
    const { where } = opts
    const params = new URLSearchParams()

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        if (typeof value === 'object' && value !== null) {
          const op = value as AnyRecord
          if ('in' in op) params.append(key, `in.(${(op.in as any[]).map(String).join(',')})`)
          else if ('not' in op) params.append(key, `neq.${op.not}`)
          else if ('contains' in op) params.append(key, `ilike.*${op.contains}*`)
          else if ('eq' in op) params.append(key, `eq.${op.eq}`)
          else params.append(key, `eq.${JSON.stringify(value)}`)
        } else {
          params.append(key, `eq.${value}`)
        }
      }
    }

    await this.request('DELETE', params, undefined, 'return=representation')
    return { count: 0 }
  }

  async upsert(opts: {
    where: AnyRecord
    create: AnyRecord
    update: AnyRecord
    include?: AnyRecord
  }): Promise<AnyRecord> {
    const { where, create: createData, update: updateData, include } = opts

    // Convert upsert where to findMany where
    const findWhere: AnyRecord = {}
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Composite unique key (e.g., siswaid_matapelajaran)
        for (const [k, v] of Object.entries(value as AnyRecord)) {
          findWhere[k] = v
        }
      } else {
        findWhere[key] = value
      }
    }

    const existing = await this.findFirst({ where: findWhere })

    if (existing) {
      return this.update({ where: { id: existing.id }, data: updateData, include })
    } else {
      return this.create({ data: createData, include })
    }
  }

  async aggregate(opts: {
    _avg?: AnyRecord
    _count?: boolean | AnyRecord
    _sum?: AnyRecord
    _min?: AnyRecord
    _max?: AnyRecord
    where?: AnyRecord
  }): Promise<AnyRecord> {
    const { _avg, _count, _sum, _min, _max, where } = opts

    // Collect fields to fetch
    const fields = new Set<string>()
    if (_avg) for (const f of Object.keys(_avg)) fields.add(f)
    if (_sum) for (const f of Object.keys(_sum)) fields.add(f)
    if (_min) for (const f of Object.keys(_min)) fields.add(f)
    if (_max) for (const f of Object.keys(_max)) fields.add(f)

    const select: AnyRecord = {}
    for (const f of fields) select[f] = true

    const records = await this.findMany({ where, select })

    const result: AnyRecord = {}

    if (_avg) {
      const avgR: AnyRecord = {}
      for (const field of Object.keys(_avg)) {
        const vals = records.map((r: any) => Number(r[field])).filter((v) => !isNaN(v))
        avgR[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
      result._avg = avgR
    }

    if (_count) {
      if (typeof _count === 'boolean') {
        result._count = records.length
      } else {
        const countR: AnyRecord = {}
        for (const field of Object.keys(_count)) {
          countR[field] = records.filter((r: any) => r[field] != null).length
        }
        result._count = countR
      }
    }

    if (_sum) {
      const sumR: AnyRecord = {}
      for (const field of Object.keys(_sum)) {
        const vals = records.map((r: any) => Number(r[field])).filter((v) => !isNaN(v))
        sumR[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
      }
      result._sum = sumR
    }

    if (_min) {
      const minR: AnyRecord = {}
      for (const field of Object.keys(_min)) {
        const vals = records.map((r: any) => r[field]).filter((v) => v != null)
        minR[field] = vals.length > 0 ? vals.reduce((a, b) => (a < b ? a : b)) : null
      }
      result._min = minR
    }

    if (_max) {
      const maxR: AnyRecord = {}
      for (const field of Object.keys(_max)) {
        const vals = records.map((r: any) => r[field]).filter((v) => v != null)
        maxR[field] = vals.length > 0 ? vals.reduce((a, b) => (a > b ? a : b)) : null
      }
      result._max = maxR
    }

    return result
  }

  async groupBy(opts: {
    by: string[]
    where?: AnyRecord
    _count?: AnyRecord
    _avg?: AnyRecord
    _sum?: AnyRecord
    _min?: AnyRecord
    _max?: AnyRecord
  }): Promise<AnyRecord[]> {
    const { by, where, _count, _avg, _sum, _min, _max } = opts

    // Collect all fields needed
    const select: AnyRecord = {}
    for (const f of by) select[f] = true
    if (_count) for (const f of Object.keys(_count)) select[f] = true
    if (_avg) for (const f of Object.keys(_avg)) select[f] = true
    if (_sum) for (const f of Object.keys(_sum)) select[f] = true
    if (_min) for (const f of Object.keys(_min)) select[f] = true
    if (_max) for (const f of Object.keys(_max)) select[f] = true

    const records = await this.findMany({ where, select })

    // Group records
    const groups = new Map<string, { key: AnyRecord; items: AnyRecord[] }>()
    for (const rec of records) {
      const gk = by.map((f) => String(rec[f])).join('\0')
      if (!groups.has(gk)) {
        const key: AnyRecord = {}
        for (const f of by) key[f] = rec[f]
        groups.set(gk, { key, items: [] })
      }
      groups.get(gk)!.items.push(rec)
    }

    // Compute aggregates per group
    const results: AnyRecord[] = []
    for (const { key, items } of groups.values()) {
      const entry: AnyRecord = { ...key }

      if (_count) {
        const countR: AnyRecord = {}
        for (const field of Object.keys(_count)) {
          countR[field] = items.filter((r: any) => r[field] != null).length
        }
        entry._count = countR
      }

      if (_sum) {
        const sumR: AnyRecord = {}
        for (const field of Object.keys(_sum)) {
          const vals = items.map((r: any) => Number(r[field])).filter((v) => !isNaN(v))
          sumR[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
        }
        entry._sum = sumR
      }

      if (_avg) {
        const avgR: AnyRecord = {}
        for (const field of Object.keys(_avg)) {
          const vals = items.map((r: any) => Number(r[field])).filter((v) => !isNaN(v))
          avgR[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
        }
        entry._avg = avgR
      }

      if (_min) {
        const minR: AnyRecord = {}
        for (const field of Object.keys(_min)) {
          const vals = items.map((r: any) => r[field]).filter((v) => v != null)
          minR[field] = vals.length > 0 ? vals.reduce((a, b) => (a < b ? a : b)) : null
        }
        entry._min = minR
      }

      if (_max) {
        const maxR: AnyRecord = {}
        for (const field of Object.keys(_max)) {
          const vals = items.map((r: any) => r[field]).filter((v) => v != null)
          maxR[field] = vals.length > 0 ? vals.reduce((a, b) => (a > b ? a : b)) : null
        }
        entry._max = maxR
      }

      results.push(entry)
    }

    return results
  }
}

// ============================================================
// Factory — produces the db object matching Prisma's interface
// ============================================================

export function createSupabaseDB() {
  return {
    rombel: new SupabaseModel('rombel'),
    siswa: new SupabaseModel('siswa'),
    nilai: new SupabaseModel('nilai'),
    eligible: new SupabaseModel('eligible'),
    // Prisma generates `tKA` (lowercase t + uppercase KA) from model TKA
    tKA: new SupabaseModel('tka'),
    admin: new SupabaseModel('admin'),
  }
}
