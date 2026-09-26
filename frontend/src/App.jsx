import { useEffect, useState } from 'react'

const STATUS_TEXT = { pending: '待处理', running: '处理中', done: '已出结论' }

export default function App() {
  const [username, setUsername] = useState('printer')
  const [password, setPassword] = useState('print123456')
  const [token, setToken] = useState(localStorage.getItem('print_token') || '')
  const [role, setRole] = useState(localStorage.getItem('print_role') || '')
  const [rows, setRows] = useState([])
  const [appeals, setAppeals] = useState([])
  const [view, setView] = useState('jobs')
  const [sheet, setSheet] = useState('插页-02')
  const [cyan, setCyan] = useState('0.08')
  const [magenta, setMagenta] = useState('0.02')
  const [appealReason, setAppealReason] = useState('')
  const [error, setError] = useState('')

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || '请求失败')
    return data
  }

  async function load() {
    setRows(await api('/api/jobs'))
  }

  async function loadAppeals() {
    setAppeals(await api('/api/appeals'))
  }

  useEffect(() => {
    if (!token) return
    load()
    loadAppeals()
    const timer = setInterval(() => {
      load()
      loadAppeals()
    }, 1000)
    return () => clearInterval(timer)
  }, [token])

  async function enter() {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    localStorage.setItem('print_token', data.access_token)
    localStorage.setItem('print_role', data.role)
    setToken(data.access_token)
    setRole(data.role)
  }

  async function send() {
    setError('')
    try {
      await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          sheet,
          cyan_mm: Number(cyan),
          magenta_mm: Number(magenta),
        }),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function appeal(jobId) {
    setError('')
    try {
      await api(`/api/jobs/${jobId}/appeal`, {
        method: 'POST',
        body: JSON.stringify({ reason: appealReason }),
      })
      setAppealReason('')
      await load()
      await loadAppeals()
    } catch (err) {
      setError(err.message)
    }
  }

  function leave() {
    localStorage.clear()
    setToken('')
    setRole('')
  }

  if (!token) {
    return (
      <main>
        <h1>印刷套准复核台</h1>
        <p>提交后接口只入队。另一进程领走偏差并写结论，页面轮询到结论出现。</p>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={enter}>登录</button>
        <p>printer / print123456 可送复核；checker / check123456 只看并可申请复议</p>
      </main>
    )
  }

  const doneRows = rows.filter((row) => row.status === 'done')

  return (
    <main>
      <h1>印刷套准复核台</h1>
      <nav>
        <button onClick={() => setView('jobs')}>任务列表</button>
        <button onClick={() => setView('appeals')}>结论复议</button>
        <button onClick={leave}>退出</button>
      </nav>
      {error && <p>{error}</p>}
      {view === 'jobs' && (
        <section>
          {role === 'writer' && (
            <p>
              <input value={sheet} onChange={(e) => setSheet(e.target.value)} />
              <input value={cyan} onChange={(e) => setCyan(e.target.value)} />
              <input value={magenta} onChange={(e) => setMagenta(e.target.value)} />
              <button onClick={send}>送复核</button>
            </p>
          )}
          <table>
            <thead>
              <tr><th>印张</th><th>青</th><th>品</th><th>状态</th><th>结论</th><th>复议次数</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.sheet}</td>
                  <td>{row.cyan_mm}</td>
                  <td>{row.magenta_mm}</td>
                  <td>{STATUS_TEXT[row.status] || row.status}</td>
                  <td>{row.verdict || '等待'}</td>
                  <td>{row.appeal_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {view === 'appeals' && (
        <section>
          <h2>结论复议</h2>
          {role === 'reader' ? (
            <p>
              <input
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="复议理由"
              />
            </p>
          ) : (
            <p>印刷员不能点复议，仅可查看可复议列表与复议履历。</p>
          )}
          <h3>可复议列表</h3>
          <table>
            <thead>
              <tr>
                <th>印张</th><th>青</th><th>品</th><th>结论</th><th>复议次数</th>
                {role === 'reader' && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {doneRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.sheet}</td>
                  <td>{row.cyan_mm}</td>
                  <td>{row.magenta_mm}</td>
                  <td>{row.verdict}</td>
                  <td>{row.appeal_count}</td>
                  {role === 'reader' && (
                    <td><button onClick={() => appeal(row.id)}>复议</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <h3>复议履历</h3>
          <table>
            <thead>
              <tr><th>印张</th><th>复议理由</th><th>复议次数</th><th>操作人</th><th>时间</th></tr>
            </thead>
            <tbody>
              {appeals.map((item) => (
                <tr key={item.id}>
                  <td>{item.sheet}</td>
                  <td>{item.reason}</td>
                  <td>{item.appeal_no}</td>
                  <td>{item.requested_by}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}
