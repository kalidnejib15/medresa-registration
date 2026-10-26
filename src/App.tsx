import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlus, Save, ArrowRightCircle, Printer, AlertTriangle, Loader2, CheckCircle2, X, Clock } from 'lucide-react'
import { supabase } from './supabase'
import { ACADEMIC_YEAR, DAYS, FEE, LEVELS, Gender, levelId, levelName } from './constants'
import { LOGO_BASE64 } from './logoBase64'

const empty = { name_am:'', name_en:'', gender:'' as ''|Gender, dob:'', school_level:'', level:0, last_page_learnt:'',
  has_tutor:false, tutor_days:[] as string[], tutor_arrival_time:'', is_yetim:false, parent_name:'', parent_phone:'',
  subcity:'', woreda:'', block:'', house_no:'', emergency_contact:'', medical_notes:'', notes:'' }
type Form = typeof empty
type Slip = { id: string; name_en: string; name_am: string; level_id: string; phone: string; at: Date; yetim: boolean }
type Row = { id: string; name_en: string; level_id: string; created_at: string }

export default function App() {
  const [f, setF] = useState<Form>(empty)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [slip, setSlip] = useState<Slip | null>(null)
  const [dup, setDup] = useState<'idle'|'checking'|'dup'|'ok'>('idle')
  const [rows, setRows] = useState<Row[]>([])
  const nextAfter = useRef(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }))
  const first = useRef<HTMLInputElement>(null)

  const loadToday = async () => {
    const d = new Date(); d.setHours(0,0,0,0)
    const { data } = await supabase.from('students').select('id,name_en,level_id,created_at')
      .eq('academic_year', ACADEMIC_YEAR).gte('created_at', d.toISOString()).order('created_at', { ascending: false }).limit(50)
    setRows((data as Row[]) ?? [])
  }
  useEffect(() => { loadToday() }, [])

  // live duplicate phone check (debounced)
  useEffect(() => {
    const p = f.parent_phone.trim()
    if (!/^0\d{9}$/.test(p)) { setDup('idle'); return }
    setDup('checking')
    const t = setTimeout(async () => {
      const { count, error } = await supabase.from('student_private').select('*', { count: 'exact', head: true }).eq('parent_phone', p)
      setDup(error ? 'idle' : (count ?? 0) > 0 ? 'dup' : 'ok')
    }, 400)
    return () => clearTimeout(t)
  }, [f.parent_phone])

  const lid = useMemo(() => f.gender && f.level ? levelId(f.level, f.gender) : '', [f.gender, f.level])
  const missing = !f.name_am.trim() || !f.name_en.trim() || !f.gender || !f.level || !f.parent_name.trim() || !/^0\d{9}$/.test(f.parent_phone.trim())

  const submit = async (next: boolean) => {
    setErr('')
    if (missing) { setErr('Please complete all required fields (names, gender, level, parent name, phone 09xxxxxxxx).'); return }
    setBusy(true); nextAfter.current = next
    const { data: s, error: e1 } = await supabase.from('students').insert({
      name_am: f.name_am.trim(), name_en: f.name_en.trim(), gender: f.gender, dob: f.dob || null,
      school_level: f.school_level || null, level_id: lid, academic_year: ACADEMIC_YEAR,
      last_page_learnt: f.last_page_learnt || null, has_tutor: f.has_tutor,
      tutor_days: f.has_tutor ? f.tutor_days : [], tutor_arrival_time: f.has_tutor ? f.tutor_arrival_time || null : null,
      is_yetim: f.is_yetim }).select('id').single()
    if (e1 || !s) { setBusy(false); setErr('Could not save student: ' + (e1?.message ?? 'unknown error')); return }
    const { error: e2 } = await supabase.from('student_private').insert({
      student_id: s.id, parent_name: f.parent_name.trim(), parent_phone: f.parent_phone.trim(),
      subcity: f.subcity || null, woreda: f.woreda || null, block: f.block || null, house_no: f.house_no || null,
      emergency_contact: f.emergency_contact || null, medical_notes: f.medical_notes || null, notes: f.notes || null })
    setBusy(false)
    if (e2) { setErr(`Student saved (ID ${s.id}) but private details failed: ${e2.message}`); return }
    setSlip({ id: String(s.id), name_en: f.name_en, name_am: f.name_am, level_id: lid, phone: f.parent_phone, at: new Date(), yetim: f.is_yetim })
    loadToday()
    if (next) { setF(empty); setDup('idle') }
  }
  const closeSlip = () => { setSlip(null); if (!nextAfter.current) setF(empty); setDup('idle'); setTimeout(() => first.current?.focus(), 50) }
  const toggleDay = (d: string) => set('tutor_days', f.tutor_days.includes(d) ? f.tutor_days.filter(x => x !== d) : [...f.tutor_days, d])

  const Seg = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) =>
    <button type="button" onClick={onClick} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${on ? 'border-emerald bg-emerald text-white' : 'border-slate-200 bg-white hover:border-emerald'}`}>{children}</button>
  const Card = ({ t, children }: { t: string; children: React.ReactNode }) =>
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="mb-4 border-l-4 border-amber-accent pl-3 text-sm font-bold tracking-wide text-emerald-dark">{t}</h2>{children}</section>
  const L = ({ t, req }: { t: string; req?: boolean }) => <label className="lbl">{t}{req && <span className="text-red-600"> *</span>}</label>

  return (<div className="min-h-screen">
    <header className="bg-slate-deep text-white noprint"><div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
      <img src={LOGO_BASE64} alt="logo" className="h-12 w-12 rounded-full ring-2 ring-amber-accent"/>
      <div><h1 className="text-lg font-bold leading-tight">Abubeker Medresa · አቡበከር መድረሳ</h1><p className="text-xs text-slate-300">Student Registration Desk</p></div>
      <span className="ml-auto rounded-full bg-amber-accent px-3 py-1 text-xs font-bold">Academic Year {ACADEMIC_YEAR}</span></div></header>

    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_300px] noprint">
      <div className="space-y-5">
        <Card t="1 · BASIC INFORMATION / መሰረታዊ መረጃ"><div className="grid gap-3 sm:grid-cols-2">
          <div><L t="Full Name (Amharic) / ሙሉ ስም" req/><input ref={first} className="inp" placeholder="አህመድ ሙሐመድ" value={f.name_am} onChange={e => set('name_am', e.target.value)}/></div>
          <div><L t="Full Name (English)" req/><input className="inp" placeholder="Ahmed Mohammed" value={f.name_en} onChange={e => set('name_en', e.target.value)}/></div>
          <div><L t="Gender / ፆታ" req/><div className="flex gap-2"><Seg on={f.gender==='male'} onClick={() => set('gender','male')}>Male · ወንድ</Seg><Seg on={f.gender==='female'} onClick={() => set('gender','female')}>Female · ሴት</Seg></div></div>
          <div><L t="Date of Birth / የትውልድ ቀን"/><input type="date" className="inp" value={f.dob} onChange={e => set('dob', e.target.value)}/></div>
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
        <div className="sticky bottom-0 flex flex-wrap gap-3 bg-slate-100/90 py-3 backdrop-blur">
          <button disabled={busy} onClick={() => submit(false)} className="flex items-center gap-2 rounded-xl bg-emerald px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-dark disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}Register Student</button>
          <button disabled={busy} onClick={() => submit(true)} className="flex items-center gap-2 rounded-xl bg-amber-accent px-5 py-3 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-50">
            <ArrowRightCircle size={16}/>Save & Register Next</button>
          <button type="button" onClick={() => { setF(empty); setErr('') }} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-white">Clear</button></div>
      </div>

      <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-dark"><UserPlus size={16}/>Registered Today</h3>
        <p className="mb-3 text-xs text-slate-500">{rows.length} student{rows.length !== 1 && 's'}</p>
        <ul className="divide-y divide-slate-100">{rows.map(r => <li key={r.id} className="py-2 text-sm"><p className="font-semibold">{r.name_en}</p>
          <p className="flex items-center justify-between text-xs text-slate-500"><span>{levelName(r.level_id)}</span><span className="flex items-center gap-1"><Clock size={11}/>{new Date(r.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span></p></li>)}
          {!rows.length && <li className="py-4 text-center text-xs text-slate-400">No registrations yet today</li>}</ul></aside>
    </main>

    {slip && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-deep/70 p-4">
      <div className="max-h-full overflow-auto rounded-2xl bg-white p-4 shadow-2xl">
        <div className="noprint mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold text-emerald"><CheckCircle2 size={18}/>Student registered</span>
          <div className="flex gap-2"><button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg bg-emerald px-3 py-2 text-xs font-bold text-white"><Printer size={14}/>Print Slip</button>
            <button onClick={closeSlip} className="rounded-lg border px-3 py-2 text-xs font-bold"><X size={14}/></button></div></div>
        <div id="slip" className="w-[420px] max-w-full border-4 border-double border-emerald bg-white p-6 text-center">
          <img src={LOGO_BASE64} alt="" className="mx-auto h-20 w-20 rounded-full"/>
          <h2 className="mt-2 text-xl font-bold text-emerald-dark">Abubeker Medresa</h2><p className="text-sm text-slate-600">አቡበከር መድረሳ</p>
          <p className="my-3 inline-block rounded bg-amber-accent px-3 py-1 text-xs font-bold tracking-widest text-white">STUDENT ADMISSION SLIP</p>
          <dl className="space-y-2 text-left text-sm">{([['Student ID', slip.id],['Name', `${slip.name_en} / ${slip.name_am}`],['Level', levelName(slip.level_id)],
            ['Fee', slip.yetim ? 'Yetim Sponsored · 0 ETB' : `Regular · ${FEE.regular} ETB`],['Parent Phone', slip.phone],['Date', slip.at.toLocaleString()],['Academic Year', ACADEMIC_YEAR]]).map(([k, v]) =>
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-300 pb-1"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}</dl>
          <p className="mt-6 border-t border-slate-400 pt-1 text-xs text-slate-500">Registrar signature / ፊርማ</p></div></div></div>}
  </div>)
}
