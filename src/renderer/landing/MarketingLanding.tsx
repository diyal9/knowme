import { useState } from 'react'
import assistantShot from './assets/codex-clipboard-acd0b97a-010f-4cae-9fa0-e22dc7fc3e2d.png'
import agentShot from './assets/codex-clipboard-8bd516b1-e2c4-4861-a3a8-01f62da04f7d.png'
import workflowShot from './assets/codex-clipboard-f2bfdd59-b9f3-4402-9a22-32883ff207f4.png'

function Logo() {
  return <a className="logo" href="#top" aria-label="KnowMe 首页"><span>K</span>KnowMe</a>
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return <figure className="screenshot"><img src={src} alt={alt} /></figure>
}

export function MarketingLanding() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="page" id="top">
      <header className="header">
        <Logo />
        <nav className={menuOpen ? 'open' : ''} aria-label="主导航"><a href="#product">产品</a><a href="#harness">Harness</a><a href="#start">开始使用</a></nav>
        <button type="button" className="menu" aria-label="打开导航" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><i /><i /></button>
      </header>

      <section className="hero wrap" id="product">
        <div className="hero-copy">
          <p className="label"><i /> KNOWME WORK</p>
          <h1>懂你的办公伙伴</h1>
          <p className="lead">不只是对话，而是真正工作。<br />越用，越懂你。</p>
          <p className="description">连接你的文件、知识和工作流，理解上下文，持续推进事情。</p>
          <a className="button" href="#start">开始使用</a>
        </div>
        <Screenshot src={assistantShot} alt="KnowMe 智能伙伴界面" />
      </section>

      <section className="build wrap" id="harness">
        <div className="section-copy">
          <p className="label"><i /> HARNESS</p>
          <h2>按你的方式工作</h2>
          <p>配置自己的 Agent，编排自己的 Workflow。把角色、能力和工作方法交给 KnowMe。</p>
        </div>
        <div className="shots">
          <div><Screenshot src={agentShot} alt="KnowMe Agent 配置界面" /><span>配置 Agent</span></div>
          <div><Screenshot src={workflowShot} alt="KnowMe Workflow 编排界面" /><span>编排 Workflow</span></div>
        </div>
      </section>

      <section className="finish" id="start">
        <div className="finish-inner wrap">
          <div><p className="label"><i /> KNOWLEDGE & MEMORY</p><h2>越用，越懂你的工作</h2></div>
          <div><p>资料、决策和经验会沉淀为长期知识。下一次工作，KnowMe 从理解开始。</p><a className="button light" href="mailto:hello@knowme.local">开始使用 KnowMe</a></div>
        </div>
      </section>

      <footer className="footer wrap"><Logo /><span>本地优先的 AI 知识工作台</span><span>© 2026 KnowMe</span></footer>
    </main>
  )
}
