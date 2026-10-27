import { useEffect, useMemo, useRef, useState } from 'react'
import {
  UserPlus, Save, ArrowRightCircle, Printer, AlertTriangle, Loader2, CheckCircle2,
  X, Clock, Pencil, Search, RefreshCw, Undo2, Users
} from 'lucide-react'
import { supabase } from './supabase'
import { ACADEMIC_YEAR, DAYS, FEE, LEVELS, Gender, levelId, levelName } from './constants'
import { LOGO_BASE64 } from './logoBase64'

const empty = {
  name_am: '', name_en: '', gender: '' as '' | Gender, dob: '', age: '', school_level: '', level: 0, last_page_learnt: '',
  has_tutor: false, tutor_days: [] as string[], tutor_arrival_time: '', is_yetim: false, parent_name: '', parent_phone: '',
  subcity: '', woreda: '', block: '', house_no: '', emergency_contact: '', medical_notes: '', notes: ''
}
type Form = typeof empty
type Slip = { age?: string; id: string; name_en: string; name_am: string; level_id: string; phone: string; at: Date; yetim: boolean }
type Row = {
  id: string
  name_en: string
  name_am?: string
  level_id: string
  created_at: string
  gender?: string
  is_yetim?: boolean | number
}

const Seg = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${on ? 'border-emerald bg-emerald text-white' : 'border-slate-200 bg-white hover:border-emerald'}`}>{children}</button>
)

const Card = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="mb-4 border-l-4 border-amber-accent pl-3 text-sm font-bold tracking-wide text-emerald-dark">{t}</h2>{children}</section>
)

const L = ({ t, req }: { t: string; req?: boolean }) => (
  <label className="lbl">{t}{req && <span className="text-red-600"> *</span>}</label>
)

export default function App() {
  const [f, setF] = useState<Form>(empty)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [slip, setSlip] = useState<Slip | null>(null)
  const [dup, setDup] = useState<'idle' | 'checking' | 'dup' | 'ok'>('idle')
  const [rows, setRows] = useState<Row[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'today'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const nextAfter = useRef(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }))
  const first = useRef<HTMLInputElement>(null)

  const loadStudents = async () => {
    setLoadingRows(true)
    const { data } = await supabase
      .from('students')
      .select('id, name_en, name_am, level_id, created_at, gender, is_yetim')
      .order('created_at', { ascending: false })
      .limit(1000)
    setRows((data as Row[]) ?? [])
    setLoadingRows(false)
  }
  useEffect(() => { loadStudents() }, [])

  // live duplicate phone check (debounced) - skip current student if editing
  useEffect(() => {
    const p = f.parent_phone.trim()
    if (!/^0\d{9}$/.test(p)) { setDup('idle'); return }
    setDup('checking')
    const t = setTimeout(async () => {
      let query = supabase.from('student_private').select('*', { count: 'exact', head: true }).eq('parent_phone', p)
      if (editingId) {
        query = query.neq('student_id', editingId)
      }
      const { count, error } = await query
      setDup(error ? 'idle' : (count ?? 0) > 0 ? 'dup' : 'ok')
    }, 400)
    return () => clearTimeout(t)
  }, [f.parent_phone, editingId])

  const lid = useMemo(() => f.gender && f.level ? levelId(f.level, f.gender) : '', [f.gender, f.level])
  const missing = !f.name_am.trim() || !f.name_en.trim() || !f.gender || !f.level || !f.parent_name.trim() || !/^0\d{9}$/.test(f.parent_phone.trim())

  const startEdit = async (studentId: string) => {
    setBusy(true)
    setErr('')
    try {
      // 1. Fetch student
      const { data: s, error: e1 } = await supabase.from('students').select('*').eq('id', studentId).single()
      if (e1 || !s) throw new Error(e1?.message || 'Student not found')

      // 2. Fetch private details
      const { data: p } = await supabase.from('student_private').select('*').eq('student_id', studentId).maybeSingle()

      // Determine level number
      let lvlNum = 0
      if (s.level_id) {
        const matched = s.level_id.match(/l(\d)/i)
        if (matched) {
          lvlNum = parseInt(matched[1], 10)
        } else {
          lvlNum = parseInt(s.level_id.replace(/\D/g, ''), 10) || 0
        }
      }
      if (!lvlNum && s.level) {
        lvlNum = Number(s.level)
      }

      // Parse tutor days
      let tDays: string[] = []
      if (Array.isArray(s.tutor_days)) {
        tDays = s.tutor_days
      } else if (typeof s.tutor_days === 'string' && s.tutor_days.trim()) {
        tDays = s.tutor_days.split(',').map((x: string) => x.trim()).filter(Boolean)
      }

      // Parse address
      let subcity = p?.subcity || ''
      let woreda = p?.woreda || ''
      let block = p?.block || ''
      let house_no = p?.house_no || ''
      if (p?.address) {
        const sc = p.address.match(/Subcity:\s*([^,]+)/i)
        const w = p.address.match(/W(?:oreda)?:\s*([^,]+)/i)
        const b = p.address.match(/B(?:lock)?:\s*([^,]+)/i)
        const h = p.address.match(/H(?:ouse(?:\s*no)?)?:\s*([^,]+)/i)
        if (sc) subcity = sc[1].trim()
        if (w) woreda = w[1].trim()
        if (b) block = b[1].trim()
        if (h) house_no = h[1].trim()
        if (!sc && !w && !b && !h && !subcity) {
          subcity = p.address
        }
      }

      // Parse age
      let calculatedAge = s.age ? String(s.age) : ''
      if (!calculatedAge && s.dob) {
        const birthYear = new Date(s.dob).getFullYear()
        if (!isNaN(birthYear)) {
          calculatedAge = String(new Date().getFullYear() - birthYear)
        }
      }

      setEditingId(studentId)
      setF({
        name_am: s.name_am || '',
        name_en: s.name_en || '',
        gender: (s.gender as Gender) || '',
        dob: s.dob || '',
        age: calculatedAge,
        school_level: s.school_level || '',
        level: lvlNum,
        last_page_learnt: s.last_page_learnt || '',
        has_tutor: Boolean(s.has_tutor),
        tutor_days: tDays,
        tutor_arrival_time: s.tutor_arrival_time || '',
        is_yetim: Boolean(s.is_yetim),
        parent_name: p?.parent_name || '',
        parent_phone: p?.parent_phone || '',
        subcity,
        woreda,
        block,
        house_no,
        emergency_contact: p?.emergency_contact || '',
        medical_notes: p?.medical_notes || '',
        notes: s.notes || p?.notes || ''
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error: any) {
      setErr('Error loading student details: ' + (error?.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setF(empty)
    setErr('')
    setDup('idle')
    setTimeout(() => first.current?.focus(), 50)
  }

  const openSlipFor = async (r: Row) => {
    try {
      setBusy(true)
      const { data: s } = await supabase.from('students').select('*').eq('id', r.id).single()
      const { data: p } = await supabase.from('student_private').select('*').eq('student_id', r.id).maybeSingle()
      setSlip({
        id: String(r.id),
        name_en: r.name_en,
        name_am: r.name_am || s?.name_am || '',
        level_id: r.level_id,
        phone: p?.parent_phone || '---',
        age: s?.age ? String(s.age) : undefined,
        at: new Date(r.created_at),
        yetim: Boolean(r.is_yetim ?? s?.is_yetim)
      })
    } catch (error: any) {
      setErr('Error loading slip: ' + (error?.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const submit = async (next: boolean) => {
    setErr('')
    if (missing) { setErr('Please complete all required fields (names, gender, level, parent name, phone 09xxxxxxxx).'); return }
    setBusy(true); nextAfter.current = next
    const fullAddress = [
      f.subcity ? `Subcity: ${f.subcity}` : '',
      f.woreda ? `W:${f.woreda}` : '',
      f.block ? `B:${f.block}` : '',
      f.house_no ? `H:${f.house_no}` : ''
    ].filter(Boolean).join(', ') || null

    if (editingId) {
      // UPDATE EXISTING STUDENT
      const { error: e1 } = await supabase.from('students').update({
        name_am: f.name_am.trim(),
        name_en: f.name_en.trim(),
        gender: f.gender,
        age: f.age ? parseInt(f.age, 10) : null,
        dob: f.age ? (new Date().getFullYear() - parseInt(f.age, 10)) + '-01-01' : (f.dob || null),
        school_level: f.school_level || null,
        level_id: lid,
        academic_year: ACADEMIC_YEAR,
        last_page_learnt: f.last_page_learnt || null,
        has_tutor: f.has_tutor ? 1 : 0,
        tutor_days: f.has_tutor && f.tutor_days.length > 0 ? f.tutor_days.join(', ') : null,
        tutor_arrival_time: f.has_tutor ? f.tutor_arrival_time || null : null,
        is_yetim: f.is_yetim ? 1 : 0,
        notes: f.notes || null
      }).eq('id', editingId)

      if (e1) {
        setBusy(false)
        setErr('Could not update student: ' + e1.message)
        return
      }

      const { error: e2 } = await supabase.from('student_private').upsert({
        student_id: editingId,
        parent_name: f.parent_name.trim(),
        parent_phone: f.parent_phone.trim(),
        address: fullAddress,
        emergency_contact: f.emergency_contact || null,
        medical_notes: f.medical_notes || null
      }, { onConflict: 'student_id' })

      setBusy(false)
      if (e2) {
        await supabase.from('student_private').update({
          parent_name: f.parent_name.trim(),
          parent_phone: f.parent_phone.trim(),
          address: fullAddress,
          emergency_contact: f.emergency_contact || null,
          medical_notes: f.medical_notes || null
        }).eq('student_id', editingId)
      }

      setSlip({ id: String(editingId), name_en: f.name_en, name_am: f.name_am, level_id: lid, phone: f.parent_phone, age: f.age, at: new Date(), yetim: f.is_yetim })
      loadStudents()
      setEditingId(null)
      if (next) { setF(empty); setDup('idle') }
      return
    }

    // CREATE NEW STUDENT
    const newStudentId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('stu_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
    const { data: s, error: e1 } = await supabase.from('students').insert({
      id: newStudentId,
      name_am: f.name_am.trim(),
      name_en: f.name_en.trim(),
      gender: f.gender,
      age: f.age ? parseInt(f.age, 10) : null,
      dob: f.age ? (new Date().getFullYear() - parseInt(f.age, 10)) + '-01-01' : (f.dob || null),
      school_level: f.school_level || null,
      level_id: lid,
      academic_year: ACADEMIC_YEAR,
      last_page_learnt: f.last_page_learnt || null,
      has_tutor: f.has_tutor ? 1 : 0,
      tutor_days: f.has_tutor && f.tutor_days.length > 0 ? f.tutor_days.join(', ') : null,
      tutor_arrival_time: f.has_tutor ? f.tutor_arrival_time || null : null,
      is_yetim: f.is_yetim ? 1 : 0,
      is_active: 1,
      notes: f.notes || null
    }).select('id').single()

    if (e1 || !s) {
      setBusy(false)
      setErr('Could not save student: ' + (e1?.message ?? 'unknown error'))
      return
    }

    const { error: e2 } = await supabase.from('student_private').insert({
      student_id: s.id,
      parent_name: f.parent_name.trim(),
      parent_phone: f.parent_phone.trim(),
      address: fullAddress,
      emergency_contact: f.emergency_contact || null,
      medical_notes: f.medical_notes || null
    })
    setBusy(false)
    if (e2) { setErr(`Student saved (ID ${s.id}) but private details failed: ${e2.message}`); return }
    setSlip({ id: String(s.id), name_en: f.name_en, name_am: f.name_am, level_id: lid, phone: f.parent_phone, age: f.age, at: new Date(), yetim: f.is_yetim })
    loadStudents()
    if (next) { setF(empty); setDup('idle') }
  }

  const closeSlip = () => {
    setSlip(null)
    if (!nextAfter.current) {
      setF(empty)
      setEditingId(null)
    }
    setDup('idle')
    setTimeout(() => first.current?.focus(), 50)
  }

  const toggleDay = (d: string) => set('tutor_days', f.tutor_days.includes(d) ? f.tutor_days.filter(x => x !== d) : [...f.tutor_days, d])

  const isToday = (dateStr: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const today = new Date()
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
  }

  const todayCount = useMemo(() => rows.filter(r => isToday(r.created_at)).length, [rows])

  const filteredRows = useMemo(() => {
    let list = rows
    if (activeTab === 'today') {
      list = list.filter(r => isToday(r.created_at))
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        (r.name_en && r.name_en.toLowerCase().includes(q)) ||
        (r.name_am && r.name_am.includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q)) ||
        (levelName(r.level_id) && levelName(r.level_id).toLowerCase().includes(q))
      )
    }
    return list
  }, [rows, activeTab, searchQuery])

  return (<div className="min-h-screen">
    <header className="bg-slate-deep text-white noprint"><div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
      <img src={LOGO_BASE64} alt="logo" className="h-12 w-12 rounded-full ring-2 ring-amber-accent"/>
      <div><h1 className="text-lg font-bold leading-tight">Abubeker Medresa · አቡበከር መድረሳ</h1><p className="text-xs text-slate-300">Student Registration Desk</p></div>
      <span className="ml-auto rounded-full bg-amber-accent px-3 py-1 text-xs font-bold">Academic Year {ACADEMIC_YEAR}</span></div></header>

    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_340px] noprint">
      <div className="space-y-5">
        {editingId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-amber-500/5 p-4 ring-1 ring-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <Pencil size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">Edit Mode / ማሻሻያ</span>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    Editing: {f.name_en || f.name_am}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-mono">ID: {editingId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Undo2 size={14} /> Cancel Edit / አዲስ ምዝገባ
            </button>
          </div>
        )}

        <Card t="1 · BASIC INFORMATION / መሰረታዊ መረጃ"><div className="grid gap-3 sm:grid-cols-2">
          <div><L t="Full Name (Amharic) / ሙሉ ስም" req/><input ref={first} className="inp" placeholder="አህመድ ሙሐመድ" value={f.name_am} onChange={e => set('name_am', e.target.value)}/></div>
          <div><L t="Full Name (English)" req/><input className="inp" placeholder="Ahmed Mohammed" value={f.name_en} onChange={e => set('name_en', e.target.value)}/></div>
          <div><L t="Gender / ፆታ" req/><div className="flex gap-2"><Seg on={f.gender==='male'} onClick={() => set('gender','male')}>Male · ወንድ</Seg><Seg on={f.gender==='female'} onClick={() => set('gender','female')}>Female · ሴት</Seg></div></div>
          <div><L t="Age / እድሜ (ዓመት)" req/><input type="number" min="4" max="25" className="inp" placeholder="e.g. 8" value={f.age} onChange={e => set('age', e.target.value)}/></div>
          <div className="sm:col-span-2"><L t="School Grade / የትምህርት ቤት ክፍል"/><input className="inp" placeholder="5th Grade / 5ኛ ክፍል" value={f.school_level} onChange={e => set('school_level', e.target.value)}/></div></div></Card>

        <Card t="2 · MEDRESA LEVEL / የመድረሳ ደረጃ"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVELS.map(l => <Seg key={l.key} on={f.level===l.key} onClick={() => set('level', l.key)}>{l.en}<span className="block text-xs font-normal opacity-80">{l.am}</span></Seg>)}</div>
          {lid && <p className="mt-2 text-xs text-slate-500">Level ID: <b className="text-emerald">{lid}</b></p>}</Card>

        <Card t="3 · ACADEMIC PROGRESS & TUTOR / ትምህርታዊ ሂደት"><div className="space-y-3">
          <div><L t="Last Page Learnt (Qir'at / Nuraniya / Quran)"/><input className="inp" placeholder="Nuraniya Page 15 or Juz 3 Page 45" value={f.last_page_learnt} onChange={e => set('last_page_learnt', e.target.value)}/></div>
          <div><L t="Has Academic Tutor? / የአካዳሚክ አስጠኚ አለው?"/><div className="flex max-w-xs gap-2"><Seg on={f.has_tutor} onClick={() => set('has_tutor', true)}>Yes · አለው</Seg><Seg on={!f.has_tutor} onClick={() => set('has_tutor', false)}>No · የለውም</Seg></div></div>
          {f.has_tutor && <div className="rounded-xl bg-emerald/5 p-3 ring-1 ring-emerald/20 space-y-3">
            <div><L t="Tutor Days / የአስጠኚ ቀናት"/><div className="flex flex-wrap gap-2">{DAYS.map(([en, am]) =>
              <button type="button" key={en} onClick={() => toggleDay(en)} className={`chip ${f.tutor_days.includes(en) ? 'border-amber-accent bg-amber-accent text-white' : 'border-slate-300 bg-white'}`}>{en} · {am}</button>)}</div></div>
            <div className="max-w-xs"><L t="Expected Arrival Time on Tutor Days"/><input type="time" className="inp" value={f.tutor_arrival_time} onChange={e => set('tutor_arrival_time', e.target.value)}/></div></div>}</div></Card>

        <Card t="4 · FINANCE & FAMILY / ፋይናንስና ቤተሰብ"><div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><L t="Financial Status / የክፍያ ሁኔታ"/><div className="flex gap-2">
            <Seg on={!f.is_yetim} onClick={() => set('is_yetim', false)}>Regular · {FEE.regular} ETB</Seg><Seg on={f.is_yetim} onClick={() => set('is_yetim', true)}>Yetim Sponsored · {FEE.yetim} ETB</Seg></div></div>
          <div><L t="Parent / Guardian Name" req/><input className="inp" value={f.parent_name} onChange={e => set('parent_name', e.target.value)}/></div>
          <div><L t="Primary Phone" req/><input inputMode="numeric" maxLength={10} className="inp" placeholder="09xxxxxxxx" value={f.parent_phone} onChange={e => set('parent_phone', e.target.value.replace(/\D/g, ''))}/>
            <p className="mt-1 flex items-center gap-1 text-xs">
              {dup==='checking' && <><Loader2 size={12} className="animate-spin"/>Checking…</>}
              {dup==='dup' && <span className="flex items-center gap-1 font-semibold text-amber-accent"><AlertTriangle size={14}/>This phone is already registered — possible sibling or duplicate.</span>}
              {dup==='ok' && <span className="flex items-center gap-1 text-emerald"><CheckCircle2 size={14}/>New phone number</span>}</p></div>
          {([['subcity','Subcity / ክ/ከተማ'],['woreda','Woreda / ወረዳ'],['block','Block / ብሎክ'],['house_no','House No / የቤት ቁጥር']] as const).map(([k, t]) =>
            <div key={k}><L t={t}/><input className="inp" value={f[k]} onChange={e => set(k, e.target.value)}/></div>)}
          <div className="sm:col-span-2"><L t="Emergency Contact (Name & Phone)"/><input className="inp" value={f.emergency_contact} onChange={e => set('emergency_contact', e.target.value)}/></div>
          <div><L t="Medical Conditions / Allergies"/><textarea rows={2} className="inp" value={f.medical_notes} onChange={e => set('medical_notes', e.target.value)}/></div>
          <div><L t="Administrative Notes"/><textarea rows={2} className="inp" value={f.notes} onChange={e => set('notes', e.target.value)}/></div></div></Card>

        {err && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</p>}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 bg-slate-100/90 py-3 backdrop-blur">
          {editingId ? (
            <>
              <button disabled={busy} onClick={() => submit(false)} className="flex items-center gap-2 rounded-xl bg-emerald px-6 py-3 text-sm font-bold text-white shadow hover:bg-emerald-dark disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}Update Student / መረጃውን አሻሽል</button>
              <button type="button" onClick={cancelEdit} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                <Undo2 size={16}/>Cancel / አቋርጥ</button>
            </>
          ) : (
            <>
              <button disabled={busy} onClick={() => submit(false)} className="flex items-center gap-2 rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-dark disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}Register Student</button>
              <button disabled={busy} onClick={() => submit(true)} className="flex items-center gap-2 rounded-xl bg-amber-accent px-5 py-3 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-50">
                <ArrowRightCircle size={16}/>Save & Register Next</button>
              <button type="button" onClick={() => { setF(empty); setErr('') }} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-white">Clear</button>
            </>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald"/>
            <h3 className="text-sm font-bold text-emerald-dark">Registered Students</h3>
          </div>
          <button
            type="button"
            onClick={loadStudents}
            title="Refresh list"
            disabled={loadingRows}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingRows ? 'animate-spin' : ''}/>
          </button>
        </div>

        {/* Tab Switcher: All vs Today */}
        <div className="mb-3 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 rounded-lg py-1.5 transition ${activeTab === 'all' ? 'bg-white text-emerald shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex-1 rounded-lg py-1.5 transition ${activeTab === 'today' ? 'bg-white text-emerald shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Today ({todayCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs outline-none focus:border-emerald focus:bg-white"
            placeholder="Search name or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X size={14}/>
            </button>
          )}
        </div>

        {/* List of students */}
        <div className="max-h-[calc(100vh-270px)] space-y-2 overflow-y-auto pr-1">
          {filteredRows.map(r => {
            const isEditingThis = editingId === r.id
            return (
              <div
                key={r.id}
                className={`group rounded-xl border p-2.5 transition ${
                  isEditingThis
                    ? 'border-amber-400 bg-amber-50/60 shadow-sm ring-2 ring-amber-300'
                    : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{r.name_en}</p>
                    {r.name_am && <p className="truncate text-[11px] text-slate-500">{r.name_am}</p>}
                  </div>
                  <span className="shrink-0 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">
                    {levelName(r.level_id).split('·')[0].trim()}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11}/>
                    {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(r.id)}
                      title="Edit whole student data"
                      className="flex items-center gap-1 rounded px-2 py-0.5 font-bold text-amber-700 bg-amber-500/15 hover:bg-amber-500/25"
                    >
                      <Pencil size={11}/>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openSlipFor(r)}
                      title="Print Admission Slip"
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <Printer size={13}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {!filteredRows.length && (
            <div className="py-8 text-center text-xs text-slate-400">
              {loadingRows ? 'Loading students...' : searchQuery ? 'No matching students found' : activeTab === 'today' ? 'No registrations yet today' : 'No students registered yet'}
            </div>
          )}
        </div>
      </aside>
    </main>

    {slip && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-deep/70 p-4">
      <div className="max-h-full overflow-auto rounded-2xl bg-white p-4 shadow-2xl">
        <div className="noprint mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold text-emerald"><CheckCircle2 size={18}/>Admission Slip Ready</span>
          <div className="flex gap-2"><button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg bg-emerald px-3 py-2 text-xs font-bold text-white"><Printer size={14}/>Print Slip</button>
            <button onClick={closeSlip} className="rounded-lg border px-3 py-2 text-xs font-bold"><X size={14}/></button></div></div>
        <div id="slip" className="w-[420px] max-w-full border-4 border-double border-emerald bg-white p-6 text-center">
          <img src={LOGO_BASE64} alt="" className="mx-auto h-20 w-20 rounded-full"/>
          <h2 className="mt-2 text-xl font-bold text-emerald-dark">Abubeker Medresa</h2><p className="text-sm text-slate-600">አቡበከር መድረሳ</p>
          <p className="my-3 inline-block rounded bg-amber-accent px-3 py-1 text-xs font-bold tracking-widest text-white">STUDENT ADMISSION SLIP</p>
          <dl className="space-y-2 text-left text-sm">{([['Student ID', slip.id],['Name', `${slip.name_en} / ${slip.name_am}`],['Level', levelName(slip.level_id)], ['Age', slip.age ? `${slip.age} yrs` : '---'],
            ['Fee', slip.yetim ? 'Yetim Sponsored · 0 ETB' : `Regular · ${FEE.regular} ETB`],['Parent Phone', slip.phone],['Date', slip.at.toLocaleString()],['Academic Year', ACADEMIC_YEAR]]).map(([k, v]) =>
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-300 pb-1"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}</dl>
          <p className="mt-6 border-t border-slate-400 pt-1 text-xs text-slate-500">Registrar signature / ፊርማ</p></div></div></div>}
  </div>)
}
